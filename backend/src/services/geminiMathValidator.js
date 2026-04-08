const axios = require('axios');
const { env } = require('../config/env');
const { validateLogsMath } = require('./mathValidator');

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

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
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

function compactLogLine(log, index) {
  const requestPayload =
    typeof log?.inputRequest === 'string' ? log.inputRequest.slice(0, 1200) : JSON.stringify(log?.inputRequest || {});
  const responsePayload =
    typeof log?.outputResponse === 'string' ? log.outputResponse.slice(0, 1200) : JSON.stringify(log?.outputResponse || {});
  return (
    `${index + 1}. service=${log?.serviceName || 'N/A'} uri=${log?.requestURI || 'N/A'} ts=${log?.timestamp || 'N/A'}\n` +
    `request=${requestPayload}\n` +
    `response=${responsePayload}`
  );
}

function tryParseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getNestedObjectByKey(root, key) {
  if (!isPlainObject(root)) return null;
  if (isPlainObject(root[key])) return root[key];
  const wrappers = ['data', 'result', 'payload', 'response', 'pricing', 'body'];
  for (const w of wrappers) {
    if (isPlainObject(root[w]) && isPlainObject(root[w][key])) {
      return root[w][key];
    }
  }
  return null;
}

function getNestedArrayByKey(root, key) {
  if (!isPlainObject(root)) return [];
  if (Array.isArray(root[key])) return root[key];
  const wrappers = ['data', 'result', 'payload', 'response', 'pricing', 'body'];
  for (const w of wrappers) {
    if (isPlainObject(root[w]) && Array.isArray(root[w][key])) {
      return root[w][key];
    }
  }
  return [];
}

function pickGrandTotalObject(root) {
  if (!isPlainObject(root)) return null;
  const direct = root.grandTotal;
  if (isPlainObject(direct)) return direct;
  const wrappers = ['data', 'result', 'payload', 'response', 'pricing', 'body'];
  for (const w of wrappers) {
    if (isPlainObject(root[w]) && isPlainObject(root[w].grandTotal)) {
      return root[w].grandTotal;
    }
  }
  return null;
}

function pickProductsArray(root) {
  const keys = ['products', 'lineItems', 'items', 'cartItems', 'orderLines'];
  for (const k of keys) {
    const arr = getNestedArrayByKey(root, k);
    if (arr.length) return arr;
  }
  return [];
}

function limitProducts(products, limit = 20) {
  return (Array.isArray(products) ? products : []).slice(0, limit).map((p) => {
    if (!isPlainObject(p)) return p;
    // keep line-math relevant fields for a compact but useful context
    const out = {};
    [
      'id',
      'sku',
      'name',
      'quantity',
      'qty',
      'unitPrice',
      'basePrice',
      'price',
      'tax',
      'taxAmount',
      'vat',
      'vatAmount',
      'discount',
      'discountAmount',
      'discountTotal',
      'markup',
      'fee',
      'surcharge',
      'lineTotal',
      'total',
      'totalWithVat',
      'grandTotal',
    ].forEach((k) => {
      if (p[k] !== undefined) out[k] = p[k];
    });
    return Object.keys(out).length ? out : p;
  });
}

function buildDeepMathContext(logs) {
  return (Array.isArray(logs) ? logs : []).slice(0, 40).map((log, index) => {
    const reqRoot =
      tryParseJson(log?.inputRequest) ||
      tryParseJson(log?.request) ||
      tryParseJson(log?.req) ||
      tryParseJson(log?.requestBody) ||
      tryParseJson(log?.payload) ||
      {};
    const resRoot =
      tryParseJson(log?.outputResponse) ||
      tryParseJson(log?.response) ||
      tryParseJson(log?.res) ||
      tryParseJson(log?.responseBody) ||
      tryParseJson(log?.data) ||
      tryParseJson(log?.result) ||
      {};

    return {
      index,
      serviceName: log?.serviceName || null,
      requestURI: log?.requestURI || null,
      timestamp: log?.timestamp || null,
      request: {
        totals: getNestedObjectByKey(reqRoot, 'totals'),
        grandTotal: pickGrandTotalObject(reqRoot),
        products: limitProducts(pickProductsArray(reqRoot)),
      },
      response: {
        totals: getNestedObjectByKey(resRoot, 'totals'),
        grandTotal: pickGrandTotalObject(resRoot),
        products: limitProducts(pickProductsArray(resRoot)),
      },
      rawMismatchText:
        typeof log?.outputResponse === 'string' && log.outputResponse.includes('!=')
          ? log.outputResponse.slice(0, 500)
          : null,
    };
  });
}

function normalizeMathValidationShape(aiResult) {
  if (!aiResult || typeof aiResult !== 'object') return null;
  const byLogRaw = Array.isArray(aiResult.byLog) ? aiResult.byLog : [];
  const byLog = byLogRaw.map((entry, index) => ({
    index: Number.isInteger(entry?.index) ? entry.index : index,
    serviceName: entry?.serviceName ?? null,
    requestURI: entry?.requestURI ?? null,
    timestamp: entry?.timestamp ?? null,
    status: ['ok', 'partial', 'mismatch', 'skipped'].includes(entry?.status) ? entry.status : 'partial',
    compared: Array.isArray(entry?.compared)
      ? entry.compared.map((c) => ({
          type: c?.type === 'formula' ? 'formula' : 'pair',
          path: String(c?.path || ''),
          requestValue: Number(c?.requestValue),
          responseValue: Number(c?.responseValue),
          match: Boolean(c?.match),
          delta: Number.isFinite(Number(c?.delta)) ? Number(c.delta) : 0,
          note: c?.note ? String(c.note) : undefined,
        }))
      : [],
    requestOnlyNumbers: Array.isArray(entry?.requestOnlyNumbers)
      ? entry.requestOnlyNumbers.map((n) => ({ path: String(n?.path || ''), value: Number(n?.value) }))
      : [],
    responseOnlyNumbers: Array.isArray(entry?.responseOnlyNumbers)
      ? entry.responseOnlyNumbers.map((n) => ({ path: String(n?.path || ''), value: Number(n?.value) }))
      : [],
    skipReason: entry?.skipReason ? String(entry.skipReason) : null,
  }));

  const summary = aiResult?.summary && typeof aiResult.summary === 'object' ? aiResult.summary : {};
  return {
    summary: {
      ok: Boolean(summary.ok),
      logsCompared: Number.isFinite(Number(summary.logsCompared)) ? Number(summary.logsCompared) : byLog.filter((l) => l.status !== 'skipped').length,
      mismatchCount: Number.isFinite(Number(summary.mismatchCount))
        ? Number(summary.mismatchCount)
        : byLog.flatMap((l) => l.compared).filter((c) => c.match === false).length,
      pairCount: Number.isFinite(Number(summary.pairCount))
        ? Number(summary.pairCount)
        : byLog.flatMap((l) => l.compared).length,
    },
    byLog,
  };
}

async function validateLogsMathWithGemini(logs) {
  if (!env.GEMINI_API_KEY) {
    return { mathValidation: validateLogsMath(logs), provider: 'deterministic', reason: 'GEMINI_API_KEY not set' };
  }
  const geminiTimeoutMs = Number(env.GEMINI_TIMEOUT_MS || 90000);

  const rawModel = env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
  const model = String(rawModel)
    .replace(/^models\//, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  const lines = (Array.isArray(logs) ? logs : []).slice(0, 20).map(compactLogLine).join('\n\n');
  const deepContext = buildDeepMathContext(logs);
  const prompt =
    'You are a strict math validator for OMS logs.\n' +
    'Perform deep financial validation using request and response payloads.\n' +
    'Primary focus: objects "totals" and "grandTotal", and "products" line calculations.\n' +
    'You MUST validate:\n' +
    '1) totals.* request vs response matching numeric fields\n' +
    '2) grandTotal object values request vs response when present\n' +
    '3) product-line math (qty*unit/base price, line total, discount/tax impact)\n' +
    '4) rollup consistency (sum products vs totals/subtotals and expected grand total)\n' +
    'Do not use status, app-id, ids, or non-financial identifiers for validation.\n' +
    'Return mismatches with clear delta values.\n' +
    'Return JSON only with EXACT schema:\n' +
    '{\n' +
    '  "summary": { "ok": true, "logsCompared": 0, "mismatchCount": 0, "pairCount": 0 },\n' +
    '  "byLog": [\n' +
    '    {\n' +
    '      "index": 0,\n' +
    '      "serviceName": "",\n' +
    '      "requestURI": "",\n' +
    '      "timestamp": "",\n' +
    '      "status": "ok|partial|mismatch|skipped",\n' +
    '      "compared": [{ "type": "pair", "path": "totals.x", "requestValue": 1, "responseValue": 1, "match": true, "delta": 0, "note": "" }],\n' +
    '      "requestOnlyNumbers": [{ "path": "totals.x", "value": 1 }],\n' +
    '      "responseOnlyNumbers": [{ "path": "totals.y", "value": 1 }],\n' +
    '      "skipReason": null\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    'DEEP_CONTEXT_JSON:\n' + JSON.stringify(deepContext) + '\n\n' +
    'RAW_LOGS_FOR_REFERENCE:\n' + lines;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 },
  };

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

  if (!response) {
    const details = lastErr?.response?.data?.error?.message || lastErr?.message || 'Gemini math validation failed';
    return { mathValidation: validateLogsMath(logs), provider: 'deterministic', reason: details };
  }

  const text = response.data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n').trim();
  const parsed = normalizeMathValidationShape(parseJsonFromText(text || ''));
  if (!parsed) {
    return { mathValidation: validateLogsMath(logs), provider: 'deterministic', reason: 'Gemini returned invalid JSON for math validation' };
  }

  return { mathValidation: parsed, provider: 'gemini' };
}

module.exports = { validateLogsMathWithGemini };

