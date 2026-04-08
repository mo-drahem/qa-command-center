/**
 * Totals-only math validation.
 * Compares numeric values under object `totals` between request and response.
 * Uses 4 decimal places for money precision.
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
    if (parsed && typeof parsed === 'object') {
      objects.push(parsed);
    }
  }
  return objects;
}

function pickTotalsObject(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.totals && typeof payload.totals === 'object') return payload.totals;

  const wrappers = ['data', 'result', 'payload', 'response', 'pricing'];
  for (const key of wrappers) {
    const child = payload[key];
    if (child && typeof child === 'object' && child.totals && typeof child.totals === 'object') {
      return child.totals;
    }
  }
  return null;
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

function mergeTotalsNumberMap(payloadObjects) {
  const merged = {};
  payloadObjects.forEach((obj) => {
    const totals = pickTotalsObject(obj);
    if (totals) flattenNumbers(totals, '', merged);
  });
  return merged;
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

    const reqMap = mergeTotalsNumberMap(collectPayloadObjects('request', log));
    const resMap = mergeTotalsNumberMap(collectPayloadObjects('response', log));
    const reqPaths = Object.keys(reqMap);
    const resPaths = Object.keys(resMap);

    if (reqPaths.length === 0 && resPaths.length === 0) {
      entry.skipReason = 'no_totals_object_or_numeric_totals';
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
        const delta = round4(a - b);
        entry.compared.push({
          type: 'pair',
          path: `totals.${path}`,
          requestValue: a,
          responseValue: b,
          match,
          delta,
        });
        if (!match) mismatchCount += 1;
      } else {
        entry.requestOnlyNumbers.push({ path: `totals.${path}`, value: reqMap[path] });
      }
    });

    resPaths.forEach((path) => {
      if (!reqSet.has(path)) {
        entry.responseOnlyNumbers.push({ path: `totals.${path}`, value: resMap[path] });
      }
    });

    if (entry.compared.some((c) => !c.match)) {
      entry.status = 'mismatch';
    } else if (entry.requestOnlyNumbers.length || entry.responseOnlyNumbers.length) {
      entry.status = 'partial';
    } else if (entry.compared.length > 0) {
      entry.status = 'ok';
    } else {
      entry.status = 'partial';
    }

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

module.exports = { validateLogsMath, round4 };
