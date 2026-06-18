const axios = require('axios');
const { env } = require('../config/env');

const MAX_LOKI_LINES = 5000;
const DEFAULT_LOOKBACK_HOURS = 24;

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

function getGrafanaSettings(environment) {
  const raw = String(environment || env.LOGGING_API_DEFAULT_ENV || 'dev').toLowerCase();
  const envKey = raw === 'prod' ? 'production' : raw;

  let baseUrl = '';
  let datasourceUid = '';
  if (envKey === 'staging') {
    baseUrl = env.GRAFANA_STAGING_BASE_URL;
    datasourceUid = env.GRAFANA_STAGING_DATASOURCE_UID;
  } else if (envKey === 'production') {
    baseUrl = env.GRAFANA_PRODUCTION_BASE_URL;
    datasourceUid = env.GRAFANA_PRODUCTION_DATASOURCE_UID;
  } else {
    baseUrl = env.GRAFANA_DEV_BASE_URL || env.LOKI_BASE_URL;
    datasourceUid = env.GRAFANA_DEV_DATASOURCE_UID;
  }

  return {
    baseUrl: String(baseUrl || '').trim(),
    datasourceUid: String(datasourceUid || '').trim(),
    apiToken: String(env.GRAFANA_API_TOKEN || env.LOKI_API_TOKEN || '').trim(),
    tracerLogqlTemplate: String(
      env.GRAFANA_TRACER_LOGQL_TEMPLATE || '{job=~"oms.*"} |~ "(?i){{tracerId}}"'
    ),
    lookbackHours: Number(env.GRAFANA_LOOKBACK_HOURS) || DEFAULT_LOOKBACK_HOURS,
  };
}

function buildLogqlFromTracer(template, tracerId) {
  const safeTracerId = String(tracerId || '').trim();
  if (!safeTracerId) return '';
  return template.replace(/\{\{tracerId\}\}/g, safeTracerId.replace(/"/g, '\\"'));
}

function resolveTimeRange(from, to, lookbackHours) {
  const endMs = to ? Date.parse(to) : Date.now();
  const startMs = from ? Date.parse(from) : endMs - lookbackHours * 60 * 60 * 1000;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('Invalid Grafana time range. Use ISO-8601 values for from/to.');
  }
  if (startMs >= endMs) {
    throw new Error('Grafana time range invalid: from must be before to.');
  }
  return {
    startNs: String(Math.floor(startMs * 1e6)),
    endNs: String(Math.floor(endMs * 1e6)),
  };
}

function buildLokiQueryUrl(settings, query, startNs, endNs) {
  const base = settings.baseUrl.replace(/\/$/, '');
  const path = settings.datasourceUid
    ? `/api/datasources/proxy/uid/${encodeURIComponent(settings.datasourceUid)}/loki/api/v1/query_range`
    : '/loki/api/v1/query_range';
  const params = new URLSearchParams({
    query,
    start: startNs,
    end: endNs,
    limit: String(MAX_LOKI_LINES),
    direction: 'forward',
  });
  return `${base}${path}?${params.toString()}`;
}

function lokiTimestampToIso(nsValue) {
  const ns = Number(nsValue);
  if (!Number.isFinite(ns)) return null;
  return new Date(ns / 1e6).toISOString();
}

function normalizeLogObject(obj, streamLabels, timestamp) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  if (typeof obj.message === 'string') {
    const inner = tryParseJson(obj.message);
    if (inner && typeof inner === 'object') {
      return normalizeLogObject(inner, streamLabels, timestamp);
    }
  }
  if (typeof obj.log === 'string') {
    const inner = tryParseJson(obj.log);
    if (inner && typeof inner === 'object') {
      return normalizeLogObject(inner, streamLabels, timestamp);
    }
  }

  const serviceName =
    obj.serviceName ||
    obj.service ||
    streamLabels.serviceName ||
    streamLabels.service ||
    streamLabels.app ||
    streamLabels.job ||
    'unknown';

  if (obj.inputRequest || obj.outputResponse) {
    return {
      ...obj,
      serviceName,
      timestamp: obj.timestamp || timestamp,
      _source: 'grafana',
      _labels: streamLabels,
    };
  }

  return {
    serviceName,
    requestURI: obj.requestURI || obj.uri || obj.path || streamLabels.requestURI || null,
    timestamp: obj.timestamp || obj['@timestamp'] || timestamp,
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
    message: obj.message || obj.msg || null,
    _source: 'grafana',
    _labels: streamLabels,
  };
}

function parseLogLine(line, streamLabels, timestamp) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return [];

  let parsed = tryParseJson(trimmed);
  if (typeof parsed === 'string') {
    parsed = tryParseJson(parsed);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeLogObject(item, streamLabels, timestamp)).filter(Boolean);
  }
  if (parsed && typeof parsed === 'object') {
    const normalized = normalizeLogObject(parsed, streamLabels, timestamp);
    return normalized ? [normalized] : [];
  }

  const embedded = extractJsonFromLine(trimmed);
  if (embedded) {
    const inner = tryParseJson(embedded);
    if (inner && typeof inner === 'object') {
      const normalized = normalizeLogObject(inner, streamLabels, timestamp);
      if (normalized) return [normalized];
    }
  }

  return [
    {
      serviceName:
        streamLabels.serviceName ||
        streamLabels.service ||
        streamLabels.app ||
        streamLabels.job ||
        'unknown',
      requestURI: streamLabels.requestURI || streamLabels.uri || null,
      timestamp,
      message: trimmed,
      outputResponse: { body: { message: trimmed } },
      _source: 'grafana',
      _labels: streamLabels,
    },
  ];
}

function normalizeLokiStreams(lokiBody) {
  const streams = lokiBody?.data?.result;
  if (!Array.isArray(streams)) return [];

  const logs = [];
  streams.forEach((stream) => {
    const labels = stream?.stream && typeof stream.stream === 'object' ? stream.stream : {};
    const values = Array.isArray(stream?.values) ? stream.values : [];
    values.forEach(([ts, line]) => {
      const timestamp = lokiTimestampToIso(ts);
      parseLogLine(line, labels, timestamp).forEach((entry) => logs.push(entry));
    });
  });

  logs.sort((a, b) => {
    const ta = Date.parse(a?.timestamp || '') || 0;
    const tb = Date.parse(b?.timestamp || '') || 0;
    return ta - tb;
  });

  return logs;
}

async function fetchGrafanaLogs({ environment, tracerId, grafanaQuery, from, to }) {
  const settings = getGrafanaSettings(environment);
  if (!settings.baseUrl) {
    throw new Error(
      'Grafana/Loki is not configured. Set GRAFANA_DEV_BASE_URL / GRAFANA_STAGING_BASE_URL ' +
        '(or LOKI_BASE_URL) and GRAFANA_API_TOKEN in config.yaml or environment.'
    );
  }

  const query =
    String(grafanaQuery || '').trim() ||
    buildLogqlFromTracer(settings.tracerLogqlTemplate, tracerId);
  if (!query) {
    throw new Error('grafanaQuery or tracerId is required for Grafana log source.');
  }

  const { startNs, endNs } = resolveTimeRange(from, to, settings.lookbackHours);
  const url = buildLokiQueryUrl(settings, query, startNs, endNs);
  const headers = { Accept: 'application/json' };
  if (settings.apiToken) {
    headers.Authorization = `Bearer ${settings.apiToken}`;
  }

  let response;
  try {
    response = await axios.get(url, { headers, timeout: 30000 });
  } catch (error) {
    const status = error?.response?.status;
    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'unknown error';
    if (status) {
      throw new Error(`Grafana/Loki query failed (HTTP ${status}): ${detail}`);
    }
    throw new Error(`Grafana/Loki unreachable: ${detail}`);
  }

  const logs = normalizeLokiStreams(response.data);
  if (!logs.length) {
    throw new Error('Grafana/Loki query returned no log lines for the given time range.');
  }

  return {
    logs,
    query,
    lineCount: logs.length,
    sourceUrl: url.split('?')[0],
    timeRange: { from: new Date(Number(startNs) / 1e6).toISOString(), to: new Date(Number(endNs) / 1e6).toISOString() },
  };
}

module.exports = {
  fetchGrafanaLogs,
  normalizeLokiStreams,
  buildLogqlFromTracer,
  getGrafanaSettings,
};
