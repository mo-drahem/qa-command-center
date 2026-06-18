const axios = require('axios');
const { env } = require('../config/env');

const NARRATIVE_RESPONSE_TIMEOUT_MS = 60_000;
const FOCUS_PROMPT_MAX_CHARS = 2000;
const CRITICAL_SERVICE_PATTERN = /PRICING-CALCULATOR|CART-SERVICE|CHECKOUT|ORDER-SERVICE|SALE-CORE|SALE-GATEWAY/i;
const CRITICAL_BODY_MAX_CHARS = 15_000;
const LIGHT_BODY_MAX_CHARS = 3_000;
const SENSITIVE_KEY_PATTERN = /^(cvv|cvc|password|secret|token|encryptednumber|number)$/i;
const SLIM_PAYLOAD_KEYS = new Set([
  'totals', 'grandtotals', 'grandtotal', 'displaytotals', 'subtotal', 'total', 'totalamount',
  'products', 'lineitems', 'items', 'cartitems', 'orderlines', 'rules', 'rulecodes', 'pricing',
  'cart', 'order', 'orders', 'payment', 'coupon', 'couponcode', 'couponlockid', 'vat', 'body',
  'data', 'result', 'pricingdata', 'success', 'value', 'amount', 'rate', 'type', 'promotiontype',
]);

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

function asBulletArray(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function flattenPricingAudit(audit) {
  if (!audit || typeof audit !== 'object') return [];
  const lines = [];
  if (audit.callCount !== undefined) lines.push(`PRICING-CALCULATOR calls: ${audit.callCount}`);
  asBulletArray(audit.callDifferences).forEach((d) => lines.push(`diff: ${d}`));
  (Array.isArray(audit.rulesPerCall) ? audit.rulesPerCall : []).forEach((call) => {
    const idx = call?.callIndex ?? '?';
    asBulletArray(call?.rules).forEach((r) => lines.push(`call ${idx} rule: ${r}`));
    asBulletArray(call?.calculationChain).forEach((c) => lines.push(`call ${idx} calc: ${c}`));
  });
  return lines;
}

function flattenVatValidation(vat) {
  if (!vat) return [];
  if (Array.isArray(vat)) return asBulletArray(vat);
  if (typeof vat === 'object') {
    return Object.entries(vat).map(([k, v]) => `${k}: ${String(v)}`);
  }
  return asBulletArray(vat);
}

function buildStorySection(title, items) {
  const bullets = asBulletArray(items).map((item) => `- ${item}`).join('\n');
  if (!bullets) return '';
  return `### ${title}\n${bullets}\n\n`;
}

function buildStoryFromInsights(insights, title = 'QA Narrative') {
  const sections = [
    ['Conclusion', insights.conclusion ? [insights.conclusion] : []],
    ['Narrative Story', insights.overviewPoints],
    ['Requests List', insights.requestList],
    ['Vital Data', insights.vitalData],
    ['Pricing Rules & Coupons', insights.pricingRuleCouponDetails],
    ['Pricing Calculator Audit', flattenPricingAudit(insights.pricingCalculatorAudit)],
    ['VAT Validation', flattenVatValidation(insights.vatValidation)],
    ['Totals Validation', insights.totalsValidation],
    ['Product ID Consistency', insights.productIdConsistency],
    ['Request Flow', insights.requestFlow],
    ['Anomalies', insights.anomalies],
    ['Recommendations', insights.recommendations],
  ];

  const body = sections.map(([heading, items]) => buildStorySection(heading, items)).join('');
  return `## ${title}\n\n${body || '### Narrative Story\n- No insights generated\n\n'}`;
}

function maskSensitiveDeep(value) {
  if (Array.isArray(value)) return value.map(maskSensitiveDeep);
  if (!isPlainObject(value)) return value;
  const out = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (SENSITIVE_KEY_PATTERN.test(key) && typeof raw === 'string') {
      out[key] = '***';
    } else {
      out[key] = maskSensitiveDeep(raw);
    }
  });
  return out;
}

function slimPayloadForAi(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => slimPayloadForAi(item, depth + 1));
  }
  if (!isPlainObject(value)) return value;
  if (depth > 4) return '[nested]';

  const out = {};
  Object.entries(value).forEach(([key, raw]) => {
    const keyLower = key.toLowerCase();
    const keep =
      SLIM_PAYLOAD_KEYS.has(keyLower) ||
      /total|amount|vat|price|rule|coupon|product|cart|order|payment|pricing/i.test(key);
    if (keep) {
      out[key] = slimPayloadForAi(raw, depth + 1);
    }
  });
  return Object.keys(out).length ? out : { _note: 'payload trimmed — no pricing fields at this level' };
}

function compactPayload(value, maxChars) {
  let parsed = parseJsonMaybe(value);
  if (parsed === null || parsed === undefined) return null;

  parsed = maskSensitiveDeep(parsed);
  if (isPlainObject(parsed) && isPlainObject(parsed.body)) {
    parsed = { body: parsed.body };
  }

  let text = JSON.stringify(parsed);
  if (text.length <= maxChars) return parsed;

  const slim = slimPayloadForAi(parsed);
  text = JSON.stringify(slim);
  if (text.length <= maxChars) return slim;

  return { _truncatedPreview: `${text.slice(0, maxChars)}…` };
}

function isCriticalServiceLog(log) {
  const label = `${log?.serviceName || ''} ${log?.requestURI || ''}`;
  return CRITICAL_SERVICE_PATTERN.test(label);
}

function compactTraceForAi(logs) {
  return (Array.isArray(logs) ? logs : []).map((log, index) => {
    const critical = isCriticalServiceLog(log);
    const maxChars = critical ? CRITICAL_BODY_MAX_CHARS : LIGHT_BODY_MAX_CHARS;
    const entry = {
      index,
      serviceName: log?.serviceName || null,
      requestURI: log?.requestURI || null,
      timestamp: log?.timestamp || null,
      durationMs: log?.durationMs ?? log?.duration ?? null,
      statusCode: log?.statusCode ?? null,
      method: log?.method || null,
    };

    const inputRequest =
      log?.inputRequest ?? log?.request ?? log?.req ?? log?.requestBody ?? log?.payload ?? null;
    const outputResponse =
      log?.outputResponse ?? log?.response ?? log?.res ?? log?.responseBody ?? log?.data ?? log?.result ?? null;

    const compactInput = compactPayload(inputRequest, maxChars);
    const compactOutput = compactPayload(outputResponse, maxChars);
    if (compactInput !== null) entry.inputRequest = compactInput;
    if (compactOutput !== null) entry.outputResponse = compactOutput;
    if (!compactInput && !compactOutput) entry._note = 'no JSON payload on this entry';

    return entry;
  });
}

function buildNarrativePrompt(traceEntries, focusPrompt, options = {}) {
  const focus = String(focusPrompt || '').trim().slice(0, FOCUS_PROMPT_MAX_CHARS);
  const focusBlock = focus
    ? `USER FOCUS INSTRUCTIONS (highest priority — override general priorities when they conflict):\n${focus}\n\n`
    : '';
  const sourceNote =
    options.logSource === 'grafana' || options.logSource === 'grafana-paste'
      ? 'NOTE: TRACE_JSON was pasted or fetched from Grafana. Entries may be raw log lines or embedded OMS JSON.\n\n'
      : '';

  return (
    'You are a QA analyst for OMS checkout API traces.\n' +
    sourceNote +
    'INPUT: a JSON array of log entries. Each entry may include inputRequest and outputResponse JSON payloads.\n' +
    'Analyze ONLY fields present in the JSON. Do not assume product IDs, rule names, or call counts.\n' +
    'Return ONLY valid JSON — no markdown fences, no explanation.\n' +
    'All array values MUST be concise bullet-point strings, never paragraphs.\n' +
    'For numeric checks show: expected | actual | delta | PASS/FAIL\n' +
    'Do NOT output placeholders like "Not found". Omit missing fields instead.\n' +
    'No item limits on arrays — list ALL rules, coupons, and validation checks you find.\n\n' +
    'ANALYSIS PRIORITIES (in order):\n' +
    '1. PRICING-CALCULATOR (/apply/on-cart): all rules (product/cart/total), computed values, success flags\n' +
    '2. VAT: products of type "vat", subTotal, rate, line items, total VAT\n' +
    '3. TOTALS: totals vs grandTotals vs displayTotals across cart, order, and payment\n' +
    '4. FLOW: chronological call list with status and duration\n' +
    '5. ANOMALIES: HTTP errors, missing fields, mismatches between calls\n' +
    '6. CONCLUSION: one executive verdict (PASS / FAIL / INCONCLUSIVE) with the main reason\n\n' +
    'OUTPUT SCHEMA:\n' +
    '{\n' +
    '  "conclusion": "PASS|FAIL|INCONCLUSIVE — 2-4 sentences summarizing the investigation",\n' +
    '  "overviewPoints": ["..."],\n' +
    '  "requestList": ["METHOD URI" or "METHOD URI -> STATUS"],\n' +
    '  "vitalData": ["app-id=...", "email=...", "totalAmount=...", "productType=..."],\n' +
    '  "pricingRuleCouponDetails": ["Call N (/apply/on-cart): couponCode=..., rules=..."],\n' +
    '  "pricingCalculatorAudit": {\n' +
    '    "callCount": 0,\n' +
    '    "rulesPerCall": [{ "callIndex": 1, "rules": ["..."], "calculationChain": ["..."] }],\n' +
    '    "callDifferences": ["..."]\n' +
    '  },\n' +
    '  "vatValidation": ["flightVat: expected | actual | PASS/FAIL", "..."],\n' +
    '  "totalsValidation": ["PASS/FAIL: field | expected | actual | delta"],\n' +
    '  "productIdConsistency": ["..."],\n' +
    '  "requestFlow": ["T+0ms SERVICE METHOD URI -> STATUS (durationMs)"],\n' +
    '  "anomalies": ["..."],\n' +
    '  "recommendations": ["..."]\n' +
    '}\n\n' +
    focusBlock +
    'TRACE_JSON:\n' +
    JSON.stringify(traceEntries)
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

async function callCopilotInsights(logs, focusPrompt, options = {}) {
  const apiKey = env.COPILOT_API_KEY;
  const model = env.COPILOT_MODEL || 'gpt-4o';
  const prompt = buildNarrativePrompt(compactTraceForAi(logs), focusPrompt, options);

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
      timeout: NARRATIVE_RESPONSE_TIMEOUT_MS,
    }
  );

  return {
    insights: parseJsonFromText(response.data?.choices?.[0]?.message?.content || ''),
    tokenUsage: normalizeTokenUsage(response.data?.usage || {}, 'copilot'),
  };
}

async function callGeminiInsights(logs, focusPrompt, options = {}) {
  const apiKey = env.GEMINI_API_KEY;
  const geminiTimeoutMs = Math.max(
    NARRATIVE_RESPONSE_TIMEOUT_MS,
    Number(env.GEMINI_TIMEOUT_MS || 90000)
  );
  const rawModel = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const model = String(rawModel)
    .replace(/^models\//, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  const prompt = buildNarrativePrompt(compactTraceForAi(logs), focusPrompt, options);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
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

async function generateNarrative(logs, options = {}) {
  const focusPrompt = String(options.focusPrompt || '').trim().slice(0, FOCUS_PROMPT_MAX_CHARS);
  const narrativeOptions = { logSource: options.logSource || 'logging-api' };
  const heuristicInsights = buildHeuristicInsights(logs);

  if (env.GEMINI_API_KEY) {
    try {
      const aiResult = await callGeminiInsights(logs, focusPrompt, narrativeOptions);
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
      const aiResult = await callCopilotInsights(logs, focusPrompt, narrativeOptions);
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

module.exports = {
  generateNarrative,
  compactTraceForAi,
  buildNarrativePrompt,
  buildStoryFromInsights,
};
