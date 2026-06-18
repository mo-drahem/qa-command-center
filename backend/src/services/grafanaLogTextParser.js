const MAX_LOG_TEXT_CHARS = 2_000_000;

function tryParseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractJsonFromLine(line) {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return line.slice(start, end + 1);
}

function normalizePastedEntry(obj, rawLine = null) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  if (obj.inputRequest || obj.outputResponse || obj.serviceName) {
    return {
      ...obj,
      _source: 'grafana-paste',
      ...(rawLine && !obj.message ? { message: rawLine } : {}),
    };
  }

  if (typeof obj.message === 'string') {
    const inner = tryParseJson(obj.message);
    if (inner && typeof inner === 'object') {
      return normalizePastedEntry(inner, obj.message);
    }
  }

  return {
    serviceName: obj.serviceName || obj.service || obj.app || obj.job || 'unknown',
    requestURI: obj.requestURI || obj.uri || obj.path || null,
    timestamp: obj.timestamp || obj['@timestamp'] || obj.time || null,
    statusCode: obj.statusCode ?? obj.status ?? null,
    method: obj.method || null,
    durationMs: obj.durationMs ?? obj.duration ?? null,
    inputRequest: obj.inputRequest || obj.request || obj.req || obj.requestBody || null,
    outputResponse:
      obj.outputResponse ||
      obj.response ||
      obj.res ||
      obj.responseBody ||
      (obj.message || obj.msg ? { body: { message: obj.message || obj.msg } } : { body: obj }),
    message: obj.message || obj.msg || rawLine || null,
    _source: 'grafana-paste',
  };
}

function pushParsedValue(logs, value, rawLine) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      const normalized = normalizePastedEntry(item, rawLine);
      if (normalized) logs.push(normalized);
    });
    return;
  }
  const normalized = normalizePastedEntry(value, rawLine);
  if (normalized) logs.push(normalized);
}

function parseLine(line, logs) {
  const trimmed = line.trim();
  if (!trimmed) return;

  const direct = tryParseJson(trimmed);
  if (direct !== null) {
    pushParsedValue(logs, direct, trimmed);
    return;
  }

  const embedded = extractJsonFromLine(trimmed);
  if (embedded) {
    const inner = tryParseJson(embedded);
    if (inner && typeof inner === 'object') {
      pushParsedValue(logs, inner, trimmed);
      return;
    }
  }

  logs.push({
    message: trimmed,
    outputResponse: { body: { message: trimmed } },
    _source: 'grafana-paste',
  });
}

function parseGrafanaLogText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  if (trimmed.length > MAX_LOG_TEXT_CHARS) {
    throw new Error(`logText exceeds maximum size of ${MAX_LOG_TEXT_CHARS} characters.`);
  }

  const whole = tryParseJson(trimmed);
  if (Array.isArray(whole)) {
    const logs = [];
    pushParsedValue(logs, whole);
    return logs;
  }
  if (whole && typeof whole === 'object') {
    const logs = [];
    pushParsedValue(logs, whole);
    return logs;
  }

  const logs = [];
  trimmed.split(/\r?\n/).forEach((line) => parseLine(line, logs));
  return logs;
}

module.exports = {
  parseGrafanaLogText,
  MAX_LOG_TEXT_CHARS,
};
