const axios = require('axios');
const { badRequest } = require('../lib/httpError');
const { getOmsLookupConfig } = require('../config/oms');
const { fastTrackIdentityDefaults } = require('../config/fastTrackDefaults');
const { validateRuleIdFormat } = require('../lib/runtimePlaceholders');

function pricingReadHeaders(runtime = {}) {
  return {
    'client-id': String(runtime.clientId || fastTrackIdentityDefaults.clientId).trim(),
    Accept: String(runtime.accept || 'application/json').trim(),
  };
}

function mdrExportHeaders(runtime = {}) {
  return {
    Accept: String(runtime.accept || 'text/csv, application/json, */*').trim(),
  };
}

function mdrExportHint(status, body) {
  const message = typeof body === 'string' ? body : body?.message || body?.error || '';
  if (status === 400 && /MDR Record not found/i.test(message)) {
    return 'No MDR rows for this rule-id in this environment. Use a rule that has MDR in staging, or try dev.';
  }
  if (status === 500 && /Internal Server Error/i.test(String(body?.error || ''))) {
    return 'Server returned 500. Do not send content-type: multipart/form-data on GET export-csv.';
  }
  return null;
}

async function pricingGet(url, headers) {
  const response = await axios.get(url, {
    headers,
    timeout: 45000,
    validateStatus: () => true,
  });
  return response;
}

function formatMdrBody(response) {
  if (response.status >= 400) return response.data;
  if (typeof response.data !== 'string') return response.data;
  const lines = response.data.trim().split('\n').filter(Boolean);
  return {
    format: 'csv',
    lineCount: lines.length,
    preview: lines.slice(0, 20),
    raw: response.data,
  };
}

async function getRules({ environment, runtime = {} }) {
  const cfg = getOmsLookupConfig(environment);
  const url = `${cfg.pricingCoreServiceBase}/rule`;
  const response = await pricingGet(url, pricingReadHeaders(runtime));
  return { sourceUrl: url, responseStatus: response.status, data: response.data };
}

async function getRuleById({ environment, ruleId, runtime = {} }) {
  const id = String(ruleId || '').trim();
  if (!id) throw badRequest('ruleId is required.');
  const ruleFormatError = validateRuleIdFormat({ ruleId: id });
  if (ruleFormatError) throw badRequest(ruleFormatError);

  const cfg = getOmsLookupConfig(environment);
  const url = `${cfg.pricingCoreServiceBase}/rule/${encodeURIComponent(id)}`;
  const response = await pricingGet(url, pricingReadHeaders(runtime));
  return { sourceUrl: url, responseStatus: response.status, data: response.data };
}

async function getCoupons({ environment, runtime = {} }) {
  const cfg = getOmsLookupConfig(environment);
  const url = `${cfg.pricingCoreServiceBase}/coupon`;
  const response = await pricingGet(url, pricingReadHeaders(runtime));
  return { sourceUrl: url, responseStatus: response.status, data: response.data };
}

async function getCouponById({ environment, couponId, runtime = {} }) {
  const id = String(couponId || '').trim();
  if (!id) throw badRequest('couponId is required.');

  const cfg = getOmsLookupConfig(environment);
  const url = `${cfg.pricingCoreServiceBase}/coupon/${encodeURIComponent(id)}`;
  const response = await pricingGet(url, pricingReadHeaders(runtime));
  return { sourceUrl: url, responseStatus: response.status, data: response.data };
}

async function getMdrOfRule({ environment, ruleId, runtime = {} }) {
  const id = String(ruleId || '').trim();
  if (!id) throw badRequest('ruleId is required.');
  const ruleFormatError = validateRuleIdFormat({ ruleId: id });
  if (ruleFormatError) throw badRequest(ruleFormatError);

  const cfg = getOmsLookupConfig(environment);
  const url = `${cfg.pricingMdrServiceBase}/mdr/export-csv/${encodeURIComponent(id)}`;
  const response = await axios.get(url, {
    headers: mdrExportHeaders(runtime),
    timeout: 45000,
    responseType: 'text',
    transformResponse: [(data) => data],
    validateStatus: () => true,
  });

  const result = {
    sourceUrl: url,
    responseStatus: response.status,
    data: formatMdrBody(response),
  };
  const hint = mdrExportHint(response.status, response.data);
  if (hint) result.hint = hint;
  return result;
}

module.exports = {
  getRules,
  getRuleById,
  getCoupons,
  getCouponById,
  getMdrOfRule,
};
