/**
 * Deterministic math validation: totals, VAT keys, line items / product pricing.
 */

const DECIMALS = 4;

function round4(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return n;
  const f = 10 ** DECIMALS;
  return Math.round(n * f) / f;
}

function numericEqual(a, b) {
  return round4(a) === round4(b);
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

function collectPayloadObjects(side, log) {
  const candidates =
    side === 'request'
      ? [log?.inputRequest, log?.request, log?.req, log?.requestBody, log?.payload]
      : [log?.outputResponse, log?.response, log?.res, log?.responseBody, log?.data, log?.result];

  const objects = [];
  for (const c of candidates) {
    const parsed = tryParseJson(c);
    if (parsed && typeof parsed === 'object') objects.push(parsed);
  }
  return objects;
}

function unwrapRoot(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const wrappers = ['data', 'result', 'payload', 'response', 'pricing', 'body'];
  for (const w of wrappers) {
    if (payload[w] && typeof payload[w] === 'object') return payload[w];
  }
  return payload;
}

function pickTotalsObject(payload) {
  const root = unwrapRoot(payload);
  if (!root || typeof root !== 'object') return null;
  if (root.totals && typeof root.totals === 'object') return root.totals;
  return null;
}

function pickLinePricingMaps(payload) {
  const root = unwrapRoot(payload);
  if (!root || typeof root !== 'object') return {};
  const out = {};
  const keys = ['lineItems', 'products', 'items', 'cartItems'];
  keys.forEach((k) => {
    const arr = root[k];
    if (Array.isArray(arr) && arr.length) {
      arr.forEach((item, i) => {
        const pricing = item?.pricing && typeof item.pricing === 'object' ? item.pricing : item;
        if (pricing && typeof pricing === 'object') flattenNumbers(pricing, `${k}[${i}]`, out);
      });
    }
  });
  return out;
}

function flattenNumbers(value, prefix = '', out = {}) {
  if (value === null || value === undefined) return out;

  if (typeof value === 'number' && Number.isFinite(value)) {
    out[prefix || '_root'] = value;
    return out;
  }

  if (typeof value === 'string') {
    const t = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
      const n = Number.parseFloat(t);
      if (Number.isFinite(n)) out[prefix || '_root'] = n;
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenNumbers(item, `${prefix}[${i}]`, out));
    return out;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = prefix ? `${prefix}.${k}` : k;
      flattenNumbers(v, p, out);
    }
  }
  return out;
}

function mergeFinancialNumberMap(payloadObjects) {
  const merged = {};
  payloadObjects.forEach((obj) => {
    const totals = pickTotalsObject(obj);
    if (totals) flattenNumbers(totals, 'totals', merged);
    const lines = pickLinePricingMaps(obj);
    Object.assign(merged, lines);
  });
  return merged;
}

function extractCurrencyFromLog(log) {
  const headerSources = [log?.requestHeaders, log?.responseHeaders, log?.headers];
  for (const h of headerSources) {
    const parsed = tryParseJson(h) || (h && typeof h === 'object' ? h : null);
    if (parsed) {
      const c = parsed['x-currency'] || parsed['X-Currency'] || parsed.currency;
      if (c) return String(c).trim().toUpperCase();
    }
  }
  const reqObjs = collectPayloadObjects('request', log);
  for (const obj of reqObjs) {
    const root = unwrapRoot(obj);
    const c = root?.currency || root?.totals?.currency;
    if (c) return String(c).trim().toUpperCase();
  }
  return null;
}

function validateLogsMath(logs) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const byLog = [];
  let mismatchCount = 0;
  let pairCount = 0;
  let logsCompared = 0;

  safeLogs.forEach((log, index) => {
    const entry = {
      index,
      serviceName: log?.serviceName ?? null,
      requestURI: log?.requestURI ?? null,
      timestamp: log?.timestamp ?? null,
      status: 'skipped',
      compared: [],
      requestOnlyNumbers: [],
      responseOnlyNumbers: [],
      skipReason: null,
    };

    if (!log) {
      entry.skipReason = 'empty_log';
      byLog.push(entry);
      return;
    }

    const reqMap = mergeFinancialNumberMap(collectPayloadObjects('request', log));
    const resMap = mergeFinancialNumberMap(collectPayloadObjects('response', log));
    const reqCurrency = extractCurrencyFromLog(log);
    const resObjs = collectPayloadObjects('response', log);
    let resCurrency = null;
    for (const obj of resObjs) {
      const root = unwrapRoot(obj);
      const c = root?.currency || root?.totals?.currency;
      if (c) resCurrency = String(c).trim().toUpperCase();
    }

    if (reqCurrency && resCurrency && reqCurrency !== resCurrency) {
      entry.compared.push({
        type: 'pair',
        path: 'currency',
        requestValue: reqCurrency,
        responseValue: resCurrency,
        match: false,
        delta: 0,
        note: 'Currency mismatch between request and response',
      });
      mismatchCount += 1;
    }

    const reqPaths = Object.keys(reqMap);
    const resPaths = Object.keys(resMap);

    if (reqPaths.length === 0 && resPaths.length === 0 && entry.compared.length === 0) {
      entry.skipReason = 'no_financial_numbers';
      byLog.push(entry);
      return;
    }

    logsCompared += 1;
    const resSet = new Set(resPaths);
    const reqSet = new Set(reqPaths);

    reqPaths.forEach((path) => {
      if (resSet.has(path)) {
        pairCount += 1;
        const a = reqMap[path];
        const b = resMap[path];
        const match = numericEqual(a, b);
        entry.compared.push({
          type: 'pair',
          path,
          requestValue: a,
          responseValue: b,
          match,
          delta: round4(a - b),
        });
        if (!match) mismatchCount += 1;
      } else {
        entry.requestOnlyNumbers.push({ path, value: reqMap[path] });
      }
    });

    resPaths.forEach((path) => {
      if (!reqSet.has(path)) entry.responseOnlyNumbers.push({ path, value: resMap[path] });
    });

    if (entry.compared.some((c) => !c.match)) entry.status = 'mismatch';
    else if (entry.requestOnlyNumbers.length || entry.responseOnlyNumbers.length) entry.status = 'partial';
    else if (entry.compared.length > 0) entry.status = 'ok';
    else entry.status = 'partial';

    byLog.push(entry);
  });

  return {
    summary: {
      ok: mismatchCount === 0,
      logsCompared,
      mismatchCount,
      pairCount,
    },
    byLog,
  };
}

module.exports = { validateLogsMath, round4, mergeFinancialNumberMap, extractCurrencyFromLog };
