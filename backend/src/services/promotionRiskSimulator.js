const axios = require('axios');
const { env } = require('../config/env');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(err) {
  const header = err?.response?.headers?.['retry-after'];
  const headerMs = Number(header);
  if (Number.isFinite(headerMs) && headerMs > 0) return Math.ceil(headerMs * 1000);
  const message = String(err?.response?.data?.error?.message || err?.message || '');
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  return 25000;
}

function parseJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackSimulation(newRule, activeRules) {
  const all = `${newRule || ''}\n${activeRules || ''}`.toLowerCase();
  const hasPercent = /%|percentage|percent/.test(all);
  const hasStackable = /stack|combin|apply together/.test(all);
  const hasCoupon = /coupon|promo/.test(all);
  const baseRisks = [];

  if (hasPercent && hasStackable) baseRisks.push('Multiple percentage promotions may stack and over-discount high-value carts.');
  if (hasCoupon) baseRisks.push('Coupon and auto-applied rule overlap can push totals below expected threshold.');
  if (!baseRisks.length) baseRisks.push('Potential hidden rule interactions due to overlapping conditions and user segments.');

  return {
    summary: ['Fallback simulation used (Gemini unavailable).', 'Review stacking and role-based combinations before release.'],
    edgeCases: [
      { title: 'VIP user + coupon + auto rule', scenario: 'VIP user applies coupon while an auto 10% rule is active.', mathRisk: 'Total discount may exceed safe margin threshold.', severity: 'high' },
      { title: 'Multi-product cart stacking', scenario: 'Flight + add-ons where both category and cart-level discounts apply.', mathRisk: 'Compounded discounts may produce near-zero final total.', severity: 'high' },
      { title: 'Role-based promo overlap', scenario: 'Special user role gets exclusive discount plus global sale.', mathRisk: 'Net margin can become negative on low-markup products.', severity: 'medium' },
    ],
    criticalSignals: baseRisks,
    recommendation: ['Add cap on total discount percentage per cart.', 'Disallow specific rule pairs from stacking.', 'Run deterministic margin guardrail checks in CI.'],
  };
}

async function simulatePromotionRisk({ environment, newRule, activeRules }) {
  if (!env.GEMINI_API_KEY) {
    return { provider: 'fallback', reason: 'GEMINI_API_KEY is not set', result: fallbackSimulation(newRule, activeRules) };
  }
  const geminiTimeoutMs = Number(env.GEMINI_TIMEOUT_MS || 90000);

  const rawModel = env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
  const model = String(rawModel)
    .replace(/^models\//, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  const prompt =
    'You are a pricing QA risk analyst for e-commerce/travel checkout.\n' +
    'Task: simulate edge-case math interactions for a new promotion rule against active rules.\n' +
    `Environment: ${environment}\n` +
    'Return ONLY JSON with this schema:\n' +
    '{ "summary": ["..."], "edgeCases": [{"title":"...","scenario":"...","mathRisk":"...","severity":"high|medium|low"}], "criticalSignals": ["..."], "recommendation": ["..."] }\n' +
    'Rules:\n- Generate at least 5 edge cases.\n- Prioritize 0 total or negative margin.\n- Use concise bullet-style text.\n\n' +
    `NEW_RULE:\n${newRule}\n\nACTIVE_RULES:\n${activeRules}`;

  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } };

  let response = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        body,
        { headers: { 'Content-Type': 'application/json' }, timeout: geminiTimeoutMs }
      );
      break;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 429 && attempt === 0) {
        await sleep(getRetryDelayMs(err));
        continue;
      }
      break;
    }
  }

  if (!response) return { provider: 'fallback', reason: lastErr?.response?.data?.error?.message || lastErr?.message || 'Gemini request failed', result: fallbackSimulation(newRule, activeRules) };

  const text = response.data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n').trim();
  const parsed = parseJsonFromText(text || '');
  if (!parsed) return { provider: 'fallback', reason: 'Gemini returned invalid JSON', result: fallbackSimulation(newRule, activeRules) };
  return { provider: 'gemini', reason: null, result: parsed };
}

module.exports = { simulatePromotionRisk };

