const axios = require('axios');
const { badRequest } = require('../lib/httpError');
const { getOmsLookupConfig } = require('./oms');
const { fastTrackIdentityDefaults } = require('./fastTrackDefaults');
const { BUSINESS_ACTIONS } = require('./businessActions');
const {
  assertAllowedFastTrackUrl,
  buildFastTrackStepRequest,
  detectRuntimeFromResponse,
} = require('./fastTrackRegistry');
const { sharedCartHeaders } = require('../lib/cartHeaders');
const {
  newCartWithProductHeaders,
  buildNewCartWithProductBody,
} = require('../lib/newCartWithProduct');
const {
  ruleIdForUrl,
  substituteRuntimeInUrl,
  validateRequiredRuntime,
  validateRuleIdFormat,
} = require('../lib/runtimePlaceholders');
const CREATE_RULE_BODY_TEMPLATE = require('../fixtures/createRule.json');

function findAction(actionId) {
  const id = String(actionId || '').trim();
  const action = BUSINESS_ACTIONS.find((a) => a.id === id);
  if (!action) throw badRequest(`Unknown actionId: ${id}`);
  return action;
}

function pricingRuleHeaders(runtime) {
  const defaults = fastTrackIdentityDefaults;
  return {
    'client-id': String(runtime.clientId || defaults.clientId).trim(),
    'Content-Type': 'application/json',
  };
}

function mdrExportHeaders(runtime = {}) {
  // Do not send content-type on GET — multipart/form-data causes 500 on this service.
  const headers = {
    Accept: String(runtime.accept || 'text/csv, application/json, */*').trim(),
  };
  const contentType = String(runtime.contentType || '').trim();
  if (contentType) headers['content-type'] = contentType;
  return headers;
}

function mdrExportHint(status, body) {
  const message = typeof body === 'string' ? body : body?.message || body?.error || '';
  if (status === 400 && /MDR Record not found/i.test(message)) {
    return 'No MDR rows for this rule-id in this environment. Use a rule that has MDR in staging, or try dev.';
  }
  if (status === 500 && /Internal Server Error/i.test(String(body?.error || ''))) {
    return 'Server returned 500. If you set content-type: multipart/form-data on a GET, remove it — that header triggers 500 on export-csv.';
  }
  return null;
}

function draftFromFastTrackStep(environment, stepId, runtime) {
  const req = buildFastTrackStepRequest({ environment, stepId, runtime });
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    data: req.data,
  };
}

function buildRuleDrafts(cfg, runtime) {
  const ruleId = ruleIdForUrl(runtime);
  const ruleHeaders = pricingRuleHeaders(runtime);

  return {
    createNewRule: {
      method: 'post',
      url: `${cfg.pricingCoreServiceBase}/rule`,
      headers: ruleHeaders,
      data: CREATE_RULE_BODY_TEMPLATE,
    },
    updateExistingRule: {
      method: 'put',
      url: `${cfg.pricingCoreServiceBase}/rule/${ruleId}`,
      headers: ruleHeaders,
      data: CREATE_RULE_BODY_TEMPLATE,
      note: 'Replace with your update-rule curl when ready.',
    },
    addMdrToRule: {
      method: 'post',
      url: `${cfg.pricingCoreServiceBase}/rule/${ruleId}/mdr`,
      headers: ruleHeaders,
      data: { mdr: {} },
      note: 'Replace with your add-MDR curl when ready.',
    },
    getMdrOfRule: {
      method: 'get',
      url: `${cfg.pricingMdrServiceBase}/mdr/export-csv/${ruleId}`,
      headers: mdrExportHeaders(runtime),
      data: undefined,
      note:
        'GET export-csv returns CSV. Do not send content-type: multipart/form-data — the MDR service returns 500. Staging may 400 if the rule has no MDR data.',
    },
  };
}

function buildNewCartWithProductDraft(cfg, runtime, productType) {
  return {
    method: 'post',
    url: `${cfg.cartServiceBase}/cart/newCartWithProduct`,
    headers: newCartWithProductHeaders(runtime),
    data: buildNewCartWithProductBody(productType),
    note: `Body from examples/new-cart-with-product-${productType}.json (type: ${productType}).`,
  };
}

function buildBusinessActionDraft({ environment, actionId, runtime = {} }) {
  const action = findAction(actionId);
  const cfg = getOmsLookupConfig(environment);

  if (action.fastTrackStepId) {
    return {
      actionId: action.id,
      title: action.title,
      category: action.category,
      requiresRuntime: action.requiresRuntime,
      draft: draftFromFastTrackStep(environment, action.fastTrackStepId, runtime),
    };
  }

  const ruleDrafts = buildRuleDrafts(cfg, runtime);
  if (ruleDrafts[action.id]) {
    const draft = ruleDrafts[action.id];
    return {
      actionId: action.id,
      title: action.title,
      category: action.category,
      requiresRuntime: action.requiresRuntime,
      draft,
    };
  }

  let draft;
  switch (action.id) {
    case 'createCartWithFlightProduct':
      draft = buildNewCartWithProductDraft(cfg, runtime, 'flight');
      break;
    case 'createCartWithHotelProduct':
      draft = buildNewCartWithProductDraft(cfg, runtime, 'hotel');
      break;
    case 'createCartWithCoupon':
      draft = {
        method: 'post',
        url: `${cfg.cartServiceBase}/cart`,
        headers: { ...sharedCartHeaders(runtime), 'x-user-phone': fastTrackIdentityDefaults.userPhone },
        data: { type: 'flight', isManual: true, isManualOrder: true },
        note: 'Runs create cart → add flight product → apply coupon (3 steps).',
        composite: action.composite,
      };
      break;
    case 'prepareAndCheckoutCart':
      draft = {
        ...draftFromFastTrackStep(environment, 'checkoutCart', runtime),
        note: 'Runs GET prepare then POST checkout on cart.',
        composite: action.composite,
      };
      break;
    case 'prepareAndCheckoutSale':
      draft = {
        ...draftFromFastTrackStep(environment, 'checkoutSale', runtime),
        note: 'Runs sale prepare then checkout.',
        composite: action.composite,
      };
      break;
    default:
      throw badRequest(`No draft builder for action: ${action.id}`);
  }

  return {
    actionId: action.id,
    title: action.title,
    category: action.category,
    requiresRuntime: action.requiresRuntime,
    draft,
  };
}

function normalizeOutboundHeaders(method, headers, hasBody) {
  const next = { ...(headers || {}) };
  const upper = String(method || 'GET').toUpperCase();
  if (upper === 'GET' && !hasBody) {
    delete next['content-type'];
    delete next['Content-Type'];
  }
  return next;
}

async function axiosCall(reqConfig) {
  const hasBody = reqConfig.data !== undefined && reqConfig.data !== null;
  const headers = normalizeOutboundHeaders(reqConfig.method, reqConfig.headers, hasBody);
  const isCsvExport = /\/export-csv\//i.test(reqConfig.url || '');

  return axios({
    method: reqConfig.method,
    url: reqConfig.url,
    headers,
    params: reqConfig.params || {},
    data: hasBody ? reqConfig.data : undefined,
    responseType: isCsvExport ? 'text' : undefined,
    transformResponse: isCsvExport ? [(data) => data] : undefined,
    timeout: 45000,
    validateStatus: () => true,
  });
}

function mergeOverride(base, override, environment) {
  const merged = {
    method: override.method || base.method,
    url: override.url || base.url,
    headers: { ...(base.headers || {}), ...(override.headers || {}) },
    params: override.params || base.params || {},
    data: Object.prototype.hasOwnProperty.call(override, 'data') ? override.data : base.data,
  };
  assertAllowedFastTrackUrl(merged.url, environment);
  return merged;
}

async function runComposite(environment, runtime, stepIds) {
  const hints = {};
  let lastResponse = null;
  const steps = [];

  for (const stepId of stepIds) {
    const reqConfig = buildFastTrackStepRequest({ environment, stepId, runtime: { ...runtime, ...hints } });
    const response = await axiosCall(reqConfig);
    const body = response.data;
    const detected = detectRuntimeFromResponse(body);
    Object.assign(hints, detected);
    if (detected.cartId) runtime.cartId = detected.cartId;
    if (detected.saleId) runtime.saleId = detected.saleId;
    lastResponse = response;
    steps.push({
      stepId,
      url: reqConfig.url,
      method: reqConfig.method,
      status: response.status,
      body,
    });
  }

  return { steps, lastResponse, runtimeHints: hints };
}

async function executeBusinessAction({ environment, actionId, runtime = {}, override = {} }) {
  const action = findAction(actionId);
  const rt = { ...runtime };

  const missingRuntime = validateRequiredRuntime(action, rt);
  if (missingRuntime.length > 0) {
    const labels = missingRuntime.map((k) => (k === 'ruleId' ? 'rule-id' : k));
    throw badRequest(`${labels.join(', ')} is required for ${actionId}`);
  }
  if (action.requiresRuntime?.includes('ruleId')) {
    const ruleFormatError = validateRuleIdFormat(rt);
    if (ruleFormatError) throw badRequest(ruleFormatError);
  }

  const useComposite = Array.isArray(action.composite) && action.composite.length > 0;
  if (useComposite && (!override.url || override.url === '')) {
    const { steps, lastResponse, runtimeHints } = await runComposite(environment, rt, action.composite);
    return {
      actionId: action.id,
      composite: true,
      steps,
      responseStatus: lastResponse.status,
      responseBody: lastResponse.data,
      runtimeHints,
    };
  }

  let reqConfig;
  if (action.fastTrackStepId && (!override.url || override.url === '')) {
    reqConfig = buildFastTrackStepRequest({
      environment,
      stepId: action.fastTrackStepId,
      runtime: rt,
      override: {},
    });
  } else {
    const { draft } = buildBusinessActionDraft({ environment, actionId, runtime: rt });
    reqConfig = {
      method: draft.method,
      url: draft.url,
      headers: draft.headers,
      data: draft.data,
    };
  }

  const resolvedOverride = {
    ...override,
    url: substituteRuntimeInUrl(override.url || reqConfig.url, rt),
  };
  const merged = mergeOverride(reqConfig, resolvedOverride, environment);
  const response = await axiosCall(merged);

  let responseBody = response.data;
  if (typeof responseBody === 'string' && /\/export-csv\//i.test(merged.url) && response.status < 400) {
    const lines = responseBody.trim().split('\n').filter(Boolean);
    responseBody = {
      format: 'csv',
      lineCount: lines.length,
      preview: lines.slice(0, 20),
      raw: responseBody,
    };
  }

  const result = {
    actionId: action.id,
    composite: false,
    sourceUrl: merged.url,
    responseStatus: response.status,
    responseBody,
    runtimeHints: detectRuntimeFromResponse(response.data),
  };

  if (action.id === 'getMdrOfRule') {
    const hint = mdrExportHint(response.status, response.data);
    if (hint) result.hint = hint;
  }

  return result;
}

module.exports = {
  buildBusinessActionDraft,
  executeBusinessAction,
  findAction,
};
