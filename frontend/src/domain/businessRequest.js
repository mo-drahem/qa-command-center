export function getAtPath(obj, path) {
  if (!path?.length) return undefined;
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function setAtPath(obj, path, value) {
  if (!path?.length) return obj;
  const next = { ...(obj || {}) };
  let cur = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    cur[key] = { ...(cur[key] && typeof cur[key] === 'object' ? cur[key] : {}) };
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
  return next;
}

export function parseJsonObject(text, fallback = {}) {
  if (!text?.trim()) return { ok: true, value: fallback };
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Expected a JSON object.' };
    }
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function stringifyJson(value, emptyObject = true) {
  if (value === undefined || value === null) {
    return emptyObject ? '{}' : '';
  }
  return JSON.stringify(value, null, 2);
}

export function formatVitalDisplay(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function extractVitalValues(fields, headers, body) {
  const values = {};
  fields.forEach((field) => {
    if (field.target === 'header' && field.key) {
      values[field.id] = formatVitalDisplay(headers?.[field.key]);
    } else if (field.target === 'body' && field.path) {
      values[field.id] = formatVitalDisplay(getAtPath(body, field.path));
    }
  });
  return values;
}

/** Re-read vital field inputs from current headers + body JSON. */
export function syncVitalValuesFromRequest(fields, headers, body) {
  return extractVitalValues(fields, headers, body);
}

export function applyVitalField(fields, fieldId, rawValue, headers, body) {
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return { headers, body };

  let nextHeaders = { ...headers };
  let nextBody = body && typeof body === 'object' ? { ...body } : {};

  if (field.target === 'header' && field.key) {
    nextHeaders[field.key] = rawValue;
  } else if (field.target === 'body' && field.path) {
    const trimmed = String(rawValue).trim();
    let parsed = rawValue;
    if (trimmed === '') parsed = '';
    else if (trimmed === 'true') parsed = true;
    else if (trimmed === 'false') parsed = false;
    else if (Number.isFinite(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) parsed = Number(trimmed);
    nextBody = setAtPath(nextBody, field.path, parsed);
  }

  return { headers: nextHeaders, body: nextBody };
}

const RUNTIME_PLACEHOLDERS = {
  ruleId: '<rule-id>',
  cartId: '<cart-id>',
  saleId: '<sale-id>',
};

/** Pricing-core rule document id (MongoDB ObjectId). */
export const RULE_ID_EXAMPLE = '6a0996c6f81d20586f29f59c';
const RULE_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isValidRuleId(value) {
  return RULE_ID_PATTERN.test(String(value || '').trim());
}

function normalizeRuntimeId(value, placeholder) {
  const id = String(value || '').trim();
  return id && id !== placeholder ? id : '';
}

export function hasRuntimeRuleId(runtime) {
  const id = normalizeRuntimeId(runtime?.ruleId, RUNTIME_PLACEHOLDERS.ruleId);
  return Boolean(id && isValidRuleId(id));
}

export function validateRuleIdFormat(runtime) {
  const id = normalizeRuntimeId(runtime?.ruleId, RUNTIME_PLACEHOLDERS.ruleId);
  if (!id) return `rule-id is required (e.g. ${RULE_ID_EXAMPLE})`;
  if (!isValidRuleId(id)) {
    return `rule-id must be a 24-character hex id (e.g. ${RULE_ID_EXAMPLE})`;
  }
  return null;
}

export function substituteRuntimeInUrl(url, runtime = {}) {
  if (!url) return url;
  let out = String(url);
  const replacements = [
    [RUNTIME_PLACEHOLDERS.ruleId, normalizeRuntimeId(runtime.ruleId, RUNTIME_PLACEHOLDERS.ruleId)],
    [RUNTIME_PLACEHOLDERS.cartId, normalizeRuntimeId(runtime.cartId, RUNTIME_PLACEHOLDERS.cartId)],
    [RUNTIME_PLACEHOLDERS.saleId, normalizeRuntimeId(runtime.saleId, RUNTIME_PLACEHOLDERS.saleId)],
  ];

  replacements.forEach(([placeholder, value]) => {
    if (!value) return;
    const encoded = encodeURIComponent(value);
    out = out.split(placeholder).join(encoded);
    out = out.split(encodeURIComponent(placeholder)).join(encoded);
  });
  return out;
}

export function validateRequiredRuntime(action, runtime) {
  const required = action?.requiresRuntime || [];
  return required.filter((key) => {
    if (key === 'ruleId') return !hasRuntimeRuleId(runtime);
    if (key === 'cartId') {
      const id = normalizeRuntimeId(runtime?.cartId, RUNTIME_PLACEHOLDERS.cartId);
      return !id;
    }
    if (key === 'saleId') {
      const id = normalizeRuntimeId(runtime?.saleId, RUNTIME_PLACEHOLDERS.saleId);
      return !id;
    }
    return !String(runtime?.[key] || '').trim();
  });
}

export function runtimeFieldLabel(key) {
  if (key === 'ruleId') return 'rule-id';
  if (key === 'cartId') return 'cart-id';
  if (key === 'saleId') return 'sale-id';
  return key;
}

export function buildExecutePayload(method, url, headers, body) {
  const upper = (method || 'GET').toUpperCase();
  const nextHeaders = { ...(headers || {}) };
  const hasBody =
    body !== undefined &&
    body !== null &&
    !(typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0);
  if (upper === 'GET' && !hasBody) {
    delete nextHeaders['content-type'];
    delete nextHeaders['Content-Type'];
  }

  const payload = {
    method: method || 'GET',
    url: url || '',
    headers: nextHeaders,
  };
  if (hasBody && upper !== 'GET') {
    payload.data = body;
  }
  return payload;
}
