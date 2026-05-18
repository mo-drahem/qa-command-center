const axios = require('axios');
const { env } = require('../config/env');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(err) {
  const header = err?.response?.headers?.['retry-after'];
  const headerMs = Number(header);
  if (Number.isFinite(headerMs) && headerMs > 0) {
    return Math.ceil(headerMs * 1000);
  }
  const message = String(err?.response?.data?.error?.message || err?.message || '');
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  return 25000;
}

const IMPORTANT_KEYS = [
  'id', 'traceId', 'tracerId', 'requestId', 'correlationId',
  'userId', 'accountId', 'sessionId', 'orderId', 'bookingId', 'paymentId',
  'status', 'statusCode', 'error', 'errorCode', 'message', 'reason',
  'amount', 'currency', 'total', 'totalAmount', 'type', 'productType', 'state', 'step',
  'appId', 'app-id', 'applicationId', 'email', 'userEmail', 'sku', 'itemType',
];

const VITAL_KEY_PATTERNS = [
  /app[-_]?id/i,
  /email/i,
  /total/i,
  /amount/i,
  /currency/i,
  /product[-_]?type/i,
  /sku/i,
  /order[-_]?id/i,
  /booking[-_]?id/i,
];

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const startsLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!startsLikeJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function compactValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isPlainObject(value)) return 'object';
  return String(value);
}

function collectImportantPairs(source, prefix = '', depth = 0, maxDepth = 2) {
  const parsedSource = parseJsonMaybe(source);
  if (!isPlainObject(parsedSource) || depth > maxDepth) return [];
  const pairs = [];

  Object.entries(parsedSource).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey);
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const keyLower = key.toLowerCase();
    const value = parseJsonMaybe(rawValue);
    const isImportant = IMPORTANT_KEYS.some((k) => keyLower.includes(k.toLowerCase()));

    if (isImportant && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      pairs.push(`${fullKey}=${compactValue(value)}`);
    }
    if (isPlainObject(value) && depth < maxDepth) {
      pairs.push(...collectImportantPairs(value, fullKey, depth + 1, maxDepth));
    }
  });
  return pairs;
}

function dedupeAndLimit(items, limit = 6) {
  return [...new Set(items)].slice(0, limit);
}

function pickSourcesByKeyPattern(log, pattern) {
  if (!isPlainObject(log)) return [];
  return Object.entries(log)
    .filter(([k]) => pattern.test(String(k)))
    .map(([, v]) => parseJsonMaybe(v))
    .filter(Boolean);
}

function extractQueryParams(requestUri) {
  if (!requestUri || typeof requestUri !== 'string' || !requestUri.includes('?')) return [];
  const query = requestUri.split('?')[1] || '';
  return query.split('&').map((p) => p.trim()).filter(Boolean).slice(0, 4);
}

function extractDataHighlights(log) {
  const requestSources = [
    log?.request, log?.req, log?.requestBody, log?.payload,
    ...pickSourcesByKeyPattern(log, /(request|req|payload|input|params|query|body)/i),
  ].filter(Boolean);
  const responseSources = [
    log?.response, log?.res, log?.responseBody, log?.data, log?.result, log?.errorDetails,
    ...pickSourcesByKeyPattern(log, /(response|res|output|result|error|exception|body)/i),
  ].filter(Boolean);

  const reqHighlights = dedupeAndLimit([
    ...requestSources.flatMap((s) => collectImportantPairs(s)),
    ...extractQueryParams(log?.requestURI),
  ]);
  const resHighlights = dedupeAndLimit([
    ...responseSources.flatMap((s) => collectImportantPairs(s)),
    ...(log?.statusCode ? [`statusCode=${log.statusCode}`] : []),
    ...(log?.errorCode ? [`errorCode=${log.errorCode}`] : []),
    ...(log?.message ? [`message=${compactValue(log.message)}`] : []),
  ]);
  return { reqHighlights, resHighlights };
}

function splitHighlightPair(pair) {
  const idx = pair.indexOf('=');
  if (idx <= 0) return null;
  const key = pair.slice(0, idx).trim();
  const value = pair.slice(idx + 1).trim();
  if (!key || !value || value === 'null' || value === 'object' || value === 'array(0)') return null;
  return { key, value };
}

function collectVitalData(logs) {
  const records = [];
  (logs || []).forEach((log) => {
    const { reqHighlights, resHighlights } = extractDataHighlights(log);
    [...reqHighlights, ...resHighlights].forEach((pair) => {
      const parsed = splitHighlightPair(pair);
      if (!parsed) return;
      if (!VITAL_KEY_PATTERNS.some((pattern) => pattern.test(parsed.key))) return;
      records.push(`${parsed.key}=${parsed.value}`);
    });
  });
  return dedupeAndLimit(records, 12);
}

function extractCheckoutVitalData(logs) {
  const result = [];
  const checkoutLike = (Array.isArray(logs) ? logs : []).filter((l) =>
    /CHECKOUT|ORDER-SERVICE|\/checkout/i.test(String(l?.serviceName || '') + ' ' + String(l?.requestURI || ''))
  );

  const pushIfFound = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    result.push(`${label}=${String(value)}`);
  };

  checkoutLike.forEach((log) => {
    const body =
      parseJsonMaybe(log?.outputResponse) ||
      parseJsonMaybe(log?.responseBody) ||
      parseJsonMaybe(log?.response) ||
      parseJsonMaybe(log?.data) ||
      parseJsonMaybe(log?.result);
    if (!body || typeof body !== 'object') return;

    walkObject(body, (key, value) => {
      const k = String(key).toLowerCase();
      if (k === 'totalamount' || k === 'total' || k === 'grandtotal') pushIfFound('totalAmount', value);
      if (k === 'producttype' || k === 'type') {
        if (typeof value === 'string' && value.trim()) pushIfFound('productType', value.trim());
      }
      if (k === 'email' || k === 'useremail') pushIfFound('email', value);
      if (k === 'app-id' || k === 'appid' || k === 'applicationid') pushIfFound('app-id', value);
    });
  });

  return dedupeAndLimit(result, 12);
}

function mergeAndFixVitalData(aiVitalData, logs) {
  const fromAi = Array.isArray(aiVitalData) ? aiVitalData.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const local = [...collectVitalData(logs), ...extractCheckoutVitalData(logs)];
  const cleanedAi = fromAi.filter((item) => !/=Not found$/i.test(item));

  const merged = [...cleanedAi];
  const existingKeys = new Set(
    cleanedAi
      .map((v) => v.split('=')[0]?.trim().toLowerCase())
      .filter(Boolean)
  );

  local.forEach((entry) => {
    const key = entry.split('=')[0]?.trim().toLowerCase();
    if (!key) return;
    if (!existingKeys.has(key)) {
      merged.push(entry);
      existingKeys.add(key);
    }
  });

  return dedupeAndLimit(merged, 20);
}

function walkObject(value, visitor, path = '') {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkObject(item, visitor, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => {
      const p = path ? `${path}.${k}` : k;
      visitor(k, v, p);
      walkObject(v, visitor, p);
    });
  }
}

function extractPricingRuleCouponDetails(logs) {
  const details = [];
  (Array.isArray(logs) ? logs : [])
    .filter((l) =>
      /PRICING-CALCULATOR/i.test(String(l?.serviceName || '')) ||
      /\/apply\/on-cart/i.test(String(l?.requestURI || ''))
    )
    .forEach((log, idx) => {
      const reqObj =
        parseJsonMaybe(log?.request) ||
        parseJsonMaybe(log?.req) ||
        parseJsonMaybe(log?.requestBody) ||
        parseJsonMaybe(log?.inputRequest) ||
        parseJsonMaybe(log?.payload) ||
        null;
      const resObj =
        parseJsonMaybe(log?.response) ||
        parseJsonMaybe(log?.res) ||
        parseJsonMaybe(log?.responseBody) ||
        parseJsonMaybe(log?.outputResponse) ||
        parseJsonMaybe(log?.data) ||
        parseJsonMaybe(log?.result) ||
        null;

      const couponCodes = [];
      const couponLocks = [];
      const rules = [];
      const ruleCodes = [];

      [reqObj, resObj].forEach((obj) => {
        if (!obj || typeof obj !== 'object') return;
        walkObject(obj, (key, value) => {
          const k = String(key).toLowerCase();
          if (k === 'couponcode') {
            if (Array.isArray(value)) value.forEach((c) => couponCodes.push(String(c)));
            else if (value !== null && value !== undefined) couponCodes.push(String(value));
          }
          if (k === 'coupon' && value) couponCodes.push(String(value));
          if (k === 'couponlockid' && value) couponLocks.push(String(value));
          if (k === 'rules' && Array.isArray(value)) {
            value.forEach((r) => {
              if (!r || typeof r !== 'object') return;
              const name = r.name || r.ruleName || r.code || r.ruleCode || 'Unnamed rule';
              const promotionType = r.promotionType || r.type || 'N/A';
              const computed = r.value ?? r.amount ?? r.discount ?? r.output ?? 'N/A';
              const success = r.success;
              rules.push(
                `rule=${name}; promotionType=${promotionType}; computed=${computed}; success=${success === undefined ? 'N/A' : String(success)}`
              );
            });
          }
          if (k === 'rulecodes' && value && typeof value === 'object') {
            Object.entries(value).forEach(([rk, rv]) => {
              ruleCodes.push(`${rk}:${Array.isArray(rv) ? rv.join(',') : String(rv)}`);
            });
          }
        });
      });

      const lines = [
        `Call ${idx + 1} (${log?.requestURI || '/apply/on-cart'})`,
        couponCodes.length ? `coupons=${[...new Set(couponCodes)].join(', ')}` : null,
        couponLocks.length ? `couponLockId=${[...new Set(couponLocks)].join(', ')}` : null,
        ruleCodes.length ? `ruleCodes=${[...new Set(ruleCodes)].join(' | ')}` : null,
        rules.length ? `rules=${[...new Set(rules)].slice(0, 12).join(' | ')}` : null,
      ].filter(Boolean);

      details.push(lines.join(' • '));
    });

  return dedupeAndLimit(details, 20);
}

function buildHeuristicInsights(logs) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const requestList = [];

  safeLogs.slice(0, 6).forEach((l) => {
    const statusPart = l.statusCode !== undefined && l.statusCode !== null ? ` -> ${l.statusCode}` : '';
    requestList.push(`${l.method || 'GET'} ${l.requestURI || '/'}${statusPart}`);
  });

  const errors = safeLogs.filter((l) => Number(l.statusCode) >= 400);
  return {
    overviewPoints: [
      `Total calls captured: ${safeLogs.length}`,
      errors.length ? `Failed calls detected: ${errors.length}` : 'No failed HTTP calls detected',
    ],
    requestList,
    vitalData: mergeAndFixVitalData([], safeLogs),
    pricingRuleCouponDetails: extractPricingRuleCouponDetails(safeLogs),
    recommendations: errors.length
      ? [
          'Inspect first failed call and validate downstream dependency response payload.',
          'Re-check app-id, user email, amount and product-type for the failed step.',
        ]
      : [
          'Validate business correctness even when HTTP status is successful.',
          'Spot-check vital business fields across the flow.',
        ],
  };
}

function buildStoryFromInsights(insights, title = 'QA Narrative') {
  const asBulletArray = (value) => {
    if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    }
    return [];
  };

  const overview = asBulletArray(insights.overviewPoints).map((p) => `- ${p}`).join('\n') || '- None';
  const requests = asBulletArray(insights.requestList).map((r) => `- ${r}`).join('\n') || '- None';
  const vitalData = asBulletArray(insights.vitalData).map((v) => `- ${v}`).join('\n') || '- None';
  const pricingDetails = asBulletArray(insights.pricingRuleCouponDetails).map((v) => `- ${v}`).join('\n') || '- None';

  return (
    `## ${title}\n\n` +
    `### Narrative Story\n${overview}\n\n` +
    `### Requests List\n${requests}\n\n` +
    `### Vital Data\n${vitalData}\n\n` +
    `### Pricing Rules & Coupons\n${pricingDetails}`
  );
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

function normalizeTokenUsage(rawUsage = {}, provider) {
  const promptTokens = Number(
    rawUsage.promptTokenCount ??
      rawUsage.prompt_tokens ??
      rawUsage.input_tokens ??
      0
  );
  const completionTokens = Number(
    rawUsage.candidatesTokenCount ??
      rawUsage.completion_tokens ??
      rawUsage.output_tokens ??
      0
  );
  const totalTokens = Number(
    rawUsage.totalTokenCount ??
      rawUsage.total_tokens ??
      promptTokens + completionTokens
  );

  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return null;

  return {
    provider,
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens,
  };
}

async function callCopilotInsights(logs) {
  const apiKey = env.COPILOT_API_KEY;
  const model = env.COPILOT_MODEL || 'gpt-4o';
  const logLines = logs
    .map((l, i) => {
      const { reqHighlights, resHighlights } = extractDataHighlights(l);
      return `${i + 1}. ${l.method || 'GET'} ${l.requestURI} status=${l.statusCode || 'N/A'} service=${l.serviceName || 'N/A'}; request=${reqHighlights.join(', ') || 'none'}; response=${resHighlights.join(', ') || 'none'}`;
    })
    .join('\n');

    const prompt = `You are a QA engineer analyzing API trace logs from a travel booking system. Return ONLY valid JSON — no markdown, no explanation.

CONTEXT — what you're looking at:
- A flight checkout flow across these services: SALE-GATEWAY → SALE-CORE → CART-SERVICE → PRICING-CALCULATOR → CHECKOUT → ORDER-SERVICE
- The PRICING-CALCULATOR is called at /apply/on-cart and returns rules applied per product
- The cart contains one flight product (prod-f0f68ffe) with a pricing rule (TESTING_1034_ALM) applied on top
- VAT is calculated as a separate product of type "vat" with its own price breakdown
- Totals appear in three places: totals, displayTotals, and grandTotals — all must be consistent

ANALYSIS PRIORITIES:

1. PRICING CALCULATOR DEEP DIVE (most critical)
   The PRICING-CALCULATOR is called 3 times. For each call:
   - List every rule in outputResponse.body  where there's 3 types of rules (product rules - cart rule - total rules) with:
     * rule name, code, type, promotionType
     * action: operation, amount/percentage, based-on field
     * computed value output
     * success=true/false
   - Show the full calculation chain for the flight product:
     * flight base price (from request pricingData.products[].base and .total)
     * rule applied: formula = (based field value) × percentage
     * verify: does the computed value match rule.value in the response?
   - Note any differences between the 3 PRICING-CALCULATOR calls (input or output changes)

2. VAT CALCULATION VALIDATION
   The VAT product's log shows: items[], rate, subTotal
   Verify:
   - subTotal = sum of all item prices in the VAT log
   - VAT amount = subTotal × rate
   - flight VAT = flight price total × 0.15
   - rule VAT = rule price total × 0.15
   - Total VAT = flight VAT + rule VAT
   Show each step with expected vs actual values

3. TOTALS CROSS-VALIDATION
   Check ALL of these must be consistent:
   - cart.totals.total = cart.grandTotals.total = displayItems.total.total
   - grandTotals.subtotal must equal sum of main product prices (excluding VAT product)
   - grandTotals.outputVat must equal VAT product price.total
   - grandTotals breakdown[prod-f0f68ffe].subTotal — verify this includes rule amount or not
   - order totals must match cart totals exactly
   - payment.paymentTotal must match final grandTotal
   - requestInput.total (checkout request) must match grandTotal
   Flag every mismatch with: field | expected | actual | delta

4. PRODUCT ID CONSISTENCY CHECK
   The rule product gets a new ID on each CART-SERVICE call:
   - CART-SERVICE call 1: prod-b9b5928d
   - CART-SERVICE call 2: prod-519fc760
   - ORDER-SERVICE: prod-d17c3e25
   Verify this is expected behavior (new cart product created each pricing cycle) and confirm the final order uses the correct product IDs.

5. REQUEST FLOW SUMMARY
   List all service calls in order with timestamps and durations.

RULES:
- All array values must be concise bullet-point strings, never paragraphs
- For numeric checks always show: expected | actual | delta (even if delta=0)
- Remove the 6-item array limit — show ALL rules and ALL validation checks
- If a calculation is correct, mark it PASS. If wrong, mark it FAIL with the delta.

OUTPUT SCHEMA:
{
  "pricingCalculatorAudit": {
    "callCount": 3,
    "rulesPerCall": [
      {
        "callIndex": 1,
        "timestamp": "...",
        "inputProductTotal": 0,
        "rules": ["rule: <name> | type: <promotionType> | condition: total > 0 | action: add 1% of Total | computed: <x> | success: true/false"],
        "calculationChain": ["flight total 500 × 1% = 5.00 SAR | rule.value=5.0 | PASS/FAIL"]
      }
    ],
    "callDifferences": ["call 1 vs 2: payment method present/absent in input"]
  },
  "vatValidation": {
    "flightVat": "500 × 0.15 = 75 | actual: 75 | PASS",
    "ruleVat": "5 × 0.15 = 0.75 | actual: 0.75 | PASS",
    "totalVat": "75 + 0.75 = 75.75 | actual: 75.75 | PASS",
    "vatSubTotal": "500 + 5 = 505 | actual: 505 | PASS"
  },
  "totalsValidation": [
    "PASS/FAIL: <field> | expected: <x> | actual: <y> | delta: <z>"
  ],
  "productIdConsistency": [
    "CART call 1 rule productId: prod-b9b5928d | CART call 2: prod-519fc760 | ORDER: prod-d17c3e25 — new ID each cycle, expected behavior: yes/no"
  ],
  "requestFlow": [
    "T+0ms SALE-GATEWAY POST /sale/.../checkout -> 200 (841ms)",
    "T+8ms SALE-CORE POST /sale/.../checkout -> 200 (833ms)"
  ],
  "vitalData": ["app-id=1034", "email=1234.fff@seera.sa", "totalAmount=580.75 SAR", "productType=flight", "saleId=sl-2c92364f", "orderId=order-5e5f826d", "paymentMethod=checkoutcom"]
}

TRACE LOGS:
${logLines}`;


  const response = await axios.post(
    'https://api.githubcopilot.com/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: 'You are a senior QA analyst. Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return {
    insights: parseJsonFromText(response.data?.choices?.[0]?.message?.content || ''),
    tokenUsage: normalizeTokenUsage(response.data?.usage || {}, 'copilot'),
  };
}

async function callGeminiInsights(logs) {
  const apiKey = env.GEMINI_API_KEY;
  const geminiTimeoutMs = Number(env.GEMINI_TIMEOUT_MS || 90000);
  const rawModel = env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
  const model = String(rawModel)
    .replace(/^models\//, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  const logLines = logs
    .map((l, i) => {
      const { reqHighlights, resHighlights } = extractDataHighlights(l);
      return `${i + 1}. ${l.method || 'GET'} ${l.requestURI} status=${l.statusCode || 'N/A'} service=${l.serviceName || 'N/A'}; request=${reqHighlights.join(', ') || 'none'}; response=${resHighlights.join(', ') || 'none'}`;
    })
    .join('\n');

  const pricingContext = extractPricingRuleCouponDetails(logs).join('\n');

  const prompt =
    'You are a QA analyst for OMS checkout traces. Return JSON only.\n' +
    'All array values MUST be concise bullet-point items, never paragraphs.\n' +
    'Prioritize PRICING-CALCULATOR output response details and list ALL rules/coupons found.\n' +
    'Schema:\n' +
    '{\n' +
    '  "overviewPoints": ["..."],\n' +
    '  "requestList": ["METHOD URI" or "METHOD URI -> STATUS when status exists"],\n' +
    '  "vitalData": ["app-id=...", "email=...", "totalAmount=...", "productType=..."],\n' +
    '  "pricingRuleCouponDetails": [\n' +
    '    "Call 1 (/apply/on-cart): couponCode=..., couponLockId=..., ruleCodes=..., rules=rule=<name>; promotionType=<type>; computed=<value>; success=<true|false>"\n' +
    '  ]\n' +
    '}\n' +
    'No 6-item limit for pricingRuleCouponDetails. Include every discovered rule/coupon from PRICING-CALCULATOR calls.\n' +
    'Do NOT output placeholders like "Not found". If missing, omit that vitalData item.\n' +
    'MUST extract totalAmount and productType from checkout/order response when present.\n\n' +
    'PRICING CONTEXT EXTRACTED FROM TRACE:\n' + pricingContext + '\n\n' +
    'TRACE LOGS:\n' + logLines;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  let response = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
            timeout: geminiTimeoutMs,
        }
      );
      break;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status === 429 && attempt === 0) {
        await sleep(getRetryDelayMs(err));
        continue;
      }
      throw err;
    }
  }

  if (!response && lastErr) {
    throw lastErr;
  }

  const text = response.data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text || '')
    .join('\n')
    .trim();
  return {
    insights: parseJsonFromText(text || ''),
    tokenUsage: normalizeTokenUsage(response.data?.usageMetadata || {}, 'gemini'),
  };
}

async function generateNarrative(logs) {
  const heuristicInsights = buildHeuristicInsights(logs);

  if (env.GEMINI_API_KEY) {
    try {
      const aiResult = await callGeminiInsights(logs);
      if (aiResult?.insights) {
        aiResult.insights.vitalData = mergeAndFixVitalData(aiResult.insights.vitalData, logs);
        return {
          story: buildStoryFromInsights(aiResult.insights, 'Gemini QA Narrative'),
          insights: aiResult.insights,
          provider: 'gemini',
          tokenUsage: aiResult.tokenUsage,
        };
      }
      return {
        story: buildStoryFromInsights(heuristicInsights, 'Fallback QA Narrative'),
        insights: heuristicInsights,
        provider: 'fallback',
        reason: 'Gemini returned non-JSON output',
        tokenUsage: null,
      };
    } catch (err) {
      const details = err?.response?.data?.error?.message || err?.response?.data?.error?.status || '';
      const reason = err.response
        ? `Gemini responded with HTTP ${err.response.status}: ${err.response.statusText}${details ? ` — ${details}` : ''}`
        : `Gemini unreachable – ${err.message}`;
      return {
        story: buildStoryFromInsights(heuristicInsights, 'Fallback QA Narrative'),
        insights: heuristicInsights,
        provider: 'fallback',
        reason,
        tokenUsage: null,
      };
    }
  }

  if (env.COPILOT_API_KEY) {
    try {
      const aiResult = await callCopilotInsights(logs);
      if (aiResult?.insights) {
        return {
          story: buildStoryFromInsights(aiResult.insights, 'Copilot QA Narrative'),
          insights: aiResult.insights,
          provider: 'copilot',
          tokenUsage: aiResult.tokenUsage,
        };
      }
      return {
        story: buildStoryFromInsights(heuristicInsights, 'Fallback QA Narrative'),
        insights: heuristicInsights,
        provider: 'fallback',
        reason: 'AI provider returned non-JSON output',
        tokenUsage: null,
      };
    } catch (err) {
      const reason = err.response
        ? `AI provider responded with HTTP ${err.response.status}: ${err.response.statusText}`
        : `AI provider unreachable – ${err.message}`;
      return {
        story: buildStoryFromInsights(heuristicInsights, 'Fallback QA Narrative'),
        insights: heuristicInsights,
        provider: 'fallback',
        reason,
        tokenUsage: null,
      };
    }
  }

  return {
    story: buildStoryFromInsights(heuristicInsights, 'Fallback QA Narrative'),
    insights: heuristicInsights,
    provider: 'fallback',
    reason: 'No AI provider API key configured (set GEMINI_API_KEY or COPILOT_API_KEY)',
    tokenUsage: null,
  };
}

module.exports = { generateNarrative };
