const axios = require('axios');
const { fetchLogs } = require('../services/loggingApi');
const { generateNarrative } = require('../services/aiNarrative');
const { validateLogsMathWithGemini } = require('../services/geminiMathValidator');
const { checkCouponConflicts } = require('../services/couponConflictChecker');
const { simulatePromotionRisk } = require('../services/promotionRiskSimulator');
const { badRequest } = require('../lib/httpError');
const { getOmsLookupConfig, normalizeEnvironment } = require('../config/oms');
const { fastTrackIdentityDefaults } = require('../config/fastTrackDefaults');
const { FAST_TRACK_SCENARIOS } = require('../config/fastTrackScenarios');
const { BUSINESS_ACTIONS, BUSINESS_ACTION_CATEGORIES } = require('../config/businessActions');
const {
  buildBusinessActionDraft,
  executeBusinessAction,
} = require('../config/businessActionRegistry');
const {
  buildFastTrackStepRequest,
  detectRuntimeFromResponse,
} = require('../config/fastTrackRegistry');
const { getExampleFixtures } = require('../lib/exampleFixtures');

const SAFE_RESPONSE_HEADERS = ['content-type', 'content-length', 'x-request-id'];

function sanitizeResponseHeaders(headers) {
  const out = {};
  SAFE_RESPONSE_HEADERS.forEach((name) => {
    if (headers?.[name] !== undefined) out[name] = headers[name];
  });
  return out;
}

function resolveLookupRequest({ environment, lookupType, value }) {
  const cfg = getOmsLookupConfig(environment);
  const encoded = encodeURIComponent(String(value || '').trim());
  switch (lookupType) {
    case 'orderNumber':
      return { url: `${cfg.saleServiceBase}/sale/order-number/${encoded}`, params: { 'response-format': 'sdk' }, headers: {} };
    case 'orderId':
      return { url: `${cfg.orderServiceBase}/order/id/${encoded}`, params: { 'response-format': 'sdk' }, headers: {} };
    case 'cartId':
      return {
        url: `${cfg.cartServiceBase}/cart/${encoded}`,
        params: {},
        headers: {
          accept: 'application/json',
          'app-id': fastTrackIdentityDefaults.appId,
          'x-include-total-with-vat': 'true',
          'x-skip-expiry-check': 'false',
        },
      };
    case 'saleId':
      return { url: `${cfg.saleServiceBase}/sale/${encoded}`, params: {}, headers: {} };
    case 'couponCodes':
      return { url: `${cfg.pricingCoreServiceBase}/coupon`, params: {}, headers: {} };
    default:
      throw badRequest('lookupType must be one of: orderNumber, orderId, cartId, saleId, couponCodes');
  }
}

function resolveBusinessScenarioStep({ environment, step, saleId, cartId, appId }) {
  const cfg = getOmsLookupConfig(environment);
  const safeSaleId = encodeURIComponent(String(saleId || '').trim());
  const safeCartId = encodeURIComponent(String(cartId || '').trim());
  const safeAppId = String(appId || '').trim() || fastTrackIdentityDefaults.appId;
  switch (step) {
    case 'createCart':
      return { method: 'post', url: `${cfg.cartServiceBase}/cart`, headers: { 'Content-Type': 'application/json' }, params: {}, data: {} };
    case 'prepare':
      if (!safeCartId) throw badRequest('cartId is required for prepare step');
      return {
        method: 'get',
        url: `${cfg.cartServiceBase}/cart/${safeCartId}/prepare`,
        headers: { accept: 'application/json', 'app-id': safeAppId },
        params: {},
        data: undefined,
      };
    case 'checkout':
      if (!safeSaleId) throw badRequest('saleId is required for checkout step');
      return {
        method: 'post',
        url: `${cfg.saleServiceBase}/sale/${safeSaleId}/checkout`,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        data: {},
      };
    default:
      throw badRequest('step must be one of: createCart, prepare, checkout');
  }
}

async function postNarrative(req, res, next) {
  try {
    const tracerId = req.body.tracerId.trim();
    const env = normalizeEnvironment(req.body.environment);
    const logs = await fetchLogs(tracerId, env);
    const [narrativeResult, mathValidationResult] = await Promise.allSettled([
      generateNarrative(logs),
      validateLogsMathWithGemini(logs),
    ]);
    const narrative =
      narrativeResult.status === 'fulfilled'
        ? narrativeResult.value
        : {
            story: 'Narrative generation timed out. Logs were fetched successfully; retry to regenerate AI narrative.',
            insights: null,
            provider: 'fallback',
            reason: narrativeResult.reason?.message || 'narrative generation failed',
          };
    const mathResult =
      mathValidationResult.status === 'fulfilled'
        ? mathValidationResult.value
        : {
            mathValidation: { summary: { ok: false, pairCount: 0, mismatchCount: 0, logsCompared: 0 }, byLog: [] },
            deterministicValidation: null,
            provider: 'deterministic',
            reason: mathValidationResult.reason?.message || 'math validation failed',
          };
    res.json({
      tracerId,
      environment: env,
      story: narrative.story,
      insights: narrative.insights || null,
      aiProvider: narrative.provider || 'fallback',
      aiReason: narrative.reason || null,
      tokenUsage: narrative.tokenUsage || null,
      mathValidation: mathResult.mathValidation,
      deterministicValidation: mathResult.deterministicValidation || null,
      mathProvider: mathResult.provider || 'deterministic',
      mathReason: mathResult.reason || null,
      logs,
    });
  } catch (error) {
    next(error);
  }
}

async function postLookup(req, res, next) {
  try {
    const { lookupType, value } = req.body || {};
    const env = normalizeEnvironment(req.body.environment);
    const reqConfig = resolveLookupRequest({
      environment: env,
      lookupType,
      value: typeof value === 'string' ? value.trim() : '',
    });
    const response = await axios.get(reqConfig.url, {
      params: reqConfig.params,
      headers: reqConfig.headers,
      timeout: 20000,
    });
    res.json({
      environment: env,
      lookupType,
      value: typeof value === 'string' ? value.trim() : '',
      sourceUrl: reqConfig.url,
      data: response.data,
    });
  } catch (error) {
    next(error);
  }
}

async function postCouponConflicts(req, res, next) {
  try {
    const env = normalizeEnvironment(req.body.environment);
    const { newCoupon } = req.body || {};
    if (!newCoupon || typeof newCoupon !== 'object' || Array.isArray(newCoupon)) {
      throw badRequest('newCoupon is required and must be a JSON object.');
    }
    const result = await checkCouponConflicts({ environment: env, newCoupon });
    res.json({ environment: env, ...result });
  } catch (error) {
    next(error);
  }
}

async function postPromotionRisk(req, res, next) {
  try {
    const env = normalizeEnvironment(req.body.environment);
    const { newRule, activeRules } = req.body || {};
    if (!newRule || typeof newRule !== 'string' || !newRule.trim()) {
      throw badRequest('newRule is required and must be a non-empty string.');
    }
    if (!activeRules || typeof activeRules !== 'string' || !activeRules.trim()) {
      throw badRequest('activeRules is required and must be a non-empty string.');
    }
    const simulation = await simulatePromotionRisk({
      environment: env,
      newRule: newRule.trim(),
      activeRules: activeRules.trim(),
    });
    res.json({
      environment: env,
      provider: simulation.provider,
      reason: simulation.reason,
      result: simulation.result,
    });
  } catch (error) {
    next(error);
  }
}

async function postBusinessScenarioStep(req, res, next) {
  console.warn('[deprecation] POST /business-scenario-step — prefer POST /fast-track/execute');
  try {
    const { step, saleId, cartId, appId } = req.body || {};
    const env = normalizeEnvironment(req.body.environment);
    if (!step || typeof step !== 'string') throw badRequest('step is required.');
    const reqConfig = resolveBusinessScenarioStep({
      environment: env,
      step: step.trim(),
      saleId,
      cartId,
      appId,
    });
    const response = await axios({
      method: reqConfig.method,
      url: reqConfig.url,
      headers: reqConfig.headers,
      params: reqConfig.params,
      data: reqConfig.data,
      timeout: 30000,
    });
    res.json({ environment: env, step: step.trim(), sourceUrl: reqConfig.url, data: response.data });
  } catch (error) {
    next(error);
  }
}

function getFastTrackScenarios(_req, res) {
  res.json({ scenarios: FAST_TRACK_SCENARIOS });
}
function getAddFlightTemplate(_req, res) {
  res.json({ body: getExampleFixtures().addFlightProductBody });
}
function getAddHotelTemplate(_req, res) {
  res.json({ body: getExampleFixtures().addHotelProductBody });
}
function getPrepareTemplate(_req, res) {
  res.json({ body: getExampleFixtures().prepareCheckoutBody });
}

function getExampleCatalog(_req, res) {
  const { fileNames } = getExampleFixtures();
  res.json({ directory: 'examples/', files: fileNames });
}

function getBusinessActions(_req, res) {
  res.json({ categories: BUSINESS_ACTION_CATEGORIES, actions: BUSINESS_ACTIONS });
}

function getBusinessActionDraft(req, res, next) {
  try {
    const env = normalizeEnvironment(req.query.environment || req.body?.environment);
    const actionId = String(req.params.actionId || '').trim();
    let runtime = {};
    try {
      if (req.query.runtime) runtime = JSON.parse(req.query.runtime);
    } catch {
      runtime = {};
    }
    const result = buildBusinessActionDraft({ environment: env, actionId, runtime });
    res.json({ environment: env, ...result });
  } catch (error) {
    next(error);
  }
}

async function postExecuteBusinessAction(req, res, next) {
  try {
    const { actionId, runtime, override } = req.body || {};
    const env = normalizeEnvironment(req.body.environment);
    if (!actionId || typeof actionId !== 'string') throw badRequest('actionId is required.');
    const result = await executeBusinessAction({
      environment: env,
      actionId: actionId.trim(),
      runtime: runtime && typeof runtime === 'object' ? runtime : {},
      override: override && typeof override === 'object' ? override : {},
    });
    res.json({ environment: env, ...result });
  } catch (error) {
    next(error);
  }
}

async function executeFastTrack(req, res, next) {
  try {
    const { stepId, runtime, override } = req.body || {};
    const env = normalizeEnvironment(req.body.environment);
    const reqConfig = buildFastTrackStepRequest({
      environment: env,
      stepId: stepId.trim(),
      runtime: runtime && typeof runtime === 'object' ? runtime : {},
      override: override && typeof override === 'object' ? override : {},
    });
    const response = await axios({
      method: reqConfig.method,
      url: reqConfig.url,
      headers: reqConfig.headers,
      params: reqConfig.params,
      data: reqConfig.data,
      timeout: 45000,
    });
    res.json({
      environment: env,
      stepId: stepId.trim(),
      responseStatus: response.status,
      responseHeaders: sanitizeResponseHeaders(response.headers),
      responseBody: response.data,
      runtimeHints: detectRuntimeFromResponse(response.data),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postNarrative,
  postLookup,
  postCouponConflicts,
  postPromotionRisk,
  postBusinessScenarioStep,
  getFastTrackScenarios,
  getAddFlightTemplate,
  getAddHotelTemplate,
  getPrepareTemplate,
  getExampleCatalog,
  executeFastTrack,
  getBusinessActions,
  getBusinessActionDraft,
  postExecuteBusinessAction,
  resolveLookupRequest,
  resolveBusinessScenarioStep,
  buildFastTrackStepRequest,
};
