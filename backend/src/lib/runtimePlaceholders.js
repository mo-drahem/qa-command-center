const PLACEHOLDERS = {
  ruleId: '<rule-id>',
  cartId: '<cart-id>',
  saleId: '<sale-id>',
};

/** Pricing-core rule document id (MongoDB ObjectId). */
const RULE_ID_PATTERN = /^[a-f0-9]{24}$/i;
const RULE_ID_EXAMPLE = '6a0996c6f81d20586f29f59c';

function isValidRuleId(value) {
  return RULE_ID_PATTERN.test(String(value || '').trim());
}

function normalizeRuntimeId(value, placeholder) {
  const id = String(value || '').trim();
  return id && id !== placeholder ? id : '';
}

function hasRuntimeRuleId(runtime) {
  const id = normalizeRuntimeId(runtime?.ruleId, PLACEHOLDERS.ruleId);
  return Boolean(id && isValidRuleId(id));
}

function hasRuntimeCartId(runtime) {
  return Boolean(normalizeRuntimeId(runtime?.cartId, PLACEHOLDERS.cartId));
}

function hasRuntimeSaleId(runtime) {
  return Boolean(normalizeRuntimeId(runtime?.saleId, PLACEHOLDERS.saleId));
}

function ruleIdForUrl(runtime) {
  const id = normalizeRuntimeId(runtime?.ruleId, PLACEHOLDERS.ruleId);
  return id ? encodeURIComponent(id) : PLACEHOLDERS.ruleId;
}

function substituteRuntimeInUrl(url, runtime = {}) {
  if (!url) return url;
  let out = String(url);
  const replacements = [
    [PLACEHOLDERS.ruleId, normalizeRuntimeId(runtime.ruleId, PLACEHOLDERS.ruleId)],
    [PLACEHOLDERS.cartId, normalizeRuntimeId(runtime.cartId, PLACEHOLDERS.cartId)],
    [PLACEHOLDERS.saleId, normalizeRuntimeId(runtime.saleId, PLACEHOLDERS.saleId)],
  ];

  replacements.forEach(([placeholder, value]) => {
    if (!value) return;
    const encoded = encodeURIComponent(value);
    out = out.split(placeholder).join(encoded);
    out = out.split(encodeURIComponent(placeholder)).join(encoded);
  });
  return out;
}

function validateRuleIdFormat(runtime) {
  const id = normalizeRuntimeId(runtime?.ruleId, PLACEHOLDERS.ruleId);
  if (!id) return `rule-id is required (e.g. ${RULE_ID_EXAMPLE})`;
  if (!isValidRuleId(id)) {
    return `rule-id must be a 24-character hex id (e.g. ${RULE_ID_EXAMPLE})`;
  }
  return null;
}

function validateRequiredRuntime(action, runtime) {
  const missing = (action.requiresRuntime || []).filter((key) => {
    if (key === 'ruleId') return !hasRuntimeRuleId(runtime);
    if (key === 'cartId') return !hasRuntimeCartId(runtime);
    if (key === 'saleId') return !hasRuntimeSaleId(runtime);
    return !String(runtime?.[key] || '').trim();
  });
  return missing;
}

module.exports = {
  PLACEHOLDERS,
  RULE_ID_EXAMPLE,
  RULE_ID_PATTERN,
  isValidRuleId,
  hasRuntimeRuleId,
  hasRuntimeCartId,
  hasRuntimeSaleId,
  ruleIdForUrl,
  substituteRuntimeInUrl,
  validateRuleIdFormat,
  validateRequiredRuntime,
};
