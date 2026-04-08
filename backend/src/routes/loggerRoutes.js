const express = require('express');
const axios = require('axios');
const { fetchLogs } = require('../services/loggingApi');
const { generateNarrative } = require('../services/aiNarrative');
const { validateLogsMathWithGemini } = require('../services/geminiMathValidator');
const { checkCouponConflicts } = require('../services/couponConflictChecker');
const { simulatePromotionRisk } = require('../services/promotionRiskSimulator');

const router = express.Router();

const ADD_FLIGHT_PRODUCT_BODY_TEMPLATE = require('../../../add-product-to-cart.json');
const ADD_HOTEL_PRODUCT_BODY_TEMPLATE = require('../../../frontend/add-hotel-product-to-cart.json');
const PREPARE_CHECKOUT_BODY_TEMPLATE = require('../../../frontend/prepare.json');

function getOmsLookupConfig(environment) {
  const envKey = environment === 'staging' ? 'staging' : 'dev';
  const hostSuffix = envKey === 'staging' ? 'staging' : 'dev';
  return {
    saleServiceBase: `http://oms-v3-sale-service.tajawal-${hostSuffix}.internal`,
    orderServiceBase: `http://oms-v2-order-service.tajawal-${hostSuffix}.internal`,
    cartServiceBase: `http://oms-v3-cart-service.tajawal-${hostSuffix}.internal`,
    checkoutServiceBase: `http://oms-v2-checkout-service.tajawal-${hostSuffix}.internal`,
    pricingCoreServiceBase: `http://oms-v2-pricing-core-service.tajawal-${hostSuffix}.internal`,
  };
}

const FAST_TRACK_SCENARIOS = [
  {
    id: 'scenario1',
    title: 'Scenario 1 - Cart + Flight',
    steps: [
      { id: 'createEmptyCart', title: 'Create Empty Cart' },
      { id: 'addFlightProduct', title: 'Add Flight Product To Cart' },
    ],
  },
  {
    id: 'scenario2',
    title: 'Scenario 2 - Cart + Hotel',
    steps: [
      { id: 'createEmptyCartHotel', title: 'Create Empty Cart' },
      { id: 'addHotelProduct', title: 'Add Hotel Product To Cart' },
    ],
  },
  {
    id: 'scenario3',
    title: 'Scenario 3 - Sale + Flight',
    steps: [
      { id: 'createSaleWithFlightProduct', title: 'Create Sale With Flight Product' },
      { id: 'prepareSaleCheckout', title: 'Prepare To Checkout' },
      { id: 'checkoutSale', title: 'Checkout Sale' },
    ],
  },
];

function buildFastTrackStepRequest({ environment, stepId, runtime = {}, override = {} }) {
  const cfg = getOmsLookupConfig(environment);
  const appId = String(runtime.appId || '50').trim();
  const cartId = String(runtime.cartId || '').trim();
  const saleId = String(runtime.saleId || '').trim();
  const hasValidCartId = /^cart-[a-z0-9-]{8,}$/i.test(cartId);
  const sharedHeaders = {
    'app-id': '50',
    'x-currency': 'SAR',
    'x-user-email': 'nabeel.seera@yahoo.com',
    'x-user-id': '5e69da2bbd561a45621a42d3',
    'Content-Type': 'application/json',
  };

  const map = {
    createEmptyCart: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart`,
      headers: {
        'app-id': appId,
        'x-user-phone': '+962795523333',
        'x-user-email': 'shams.elastic@seera.sa',
        'x-currency': 'SAR',
        'x-user-id': '6370935c00fc67000b6d3f72',
        'Content-Type': 'application/json',
      },
      data: {
        type: 'flight',
        isManual: true,
        isManualOrder: true,
      },
    },
    createEmptyCartHotel: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart`,
      headers: {
        'app-id': appId,
        'x-user-phone': '+962795523333',
        'x-user-email': 'shams.elastic@seera.sa',
        'x-currency': 'SAR',
        'x-user-id': '6370935c00fc67000b6d3f72',
        'Content-Type': 'application/json',
      },
      data: {
        type: 'hotel',
        isManual: true,
        isManualOrder: true,
      },
    },
    addFlightProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/product`,
      headers: {
        'app-id': appId,
        'x-user-id': '5e69da2bbd561a45621a42d3',
        'x-user-email': 'nabeel.seera@yahoo.com',
        'x-currency': 'SAR',
        'x-include-total-with-vat': 'false',
        'Content-Type': 'application/json',
      },
      data: ADD_FLIGHT_PRODUCT_BODY_TEMPLATE,
      required: ['cartId'],
    },
    addHotelProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/product`,
      headers: {
        'app-id': appId,
        'x-user-id': '5e69da2bbd561a45621a42d3',
        'x-user-email': 'nabeel.seera@yahoo.com',
        'x-currency': 'SAR',
        'x-include-total-with-vat': 'false',
        'Content-Type': 'application/json',
      },
      data: ADD_HOTEL_PRODUCT_BODY_TEMPLATE,
      required: ['cartId'],
    },
    createSaleWithFlightProduct: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/create-list-products`,
      headers: {
        'app-id': String(runtime.appId || '1034'),
        'x-user-phone': '+962795526409',
        'x-user-email': 'shams.alafeef@seera.sa',
        'x-currency': 'SAR',
        'x-user-id': '6370935c00fc67000b6d3f72',
        'x-b2b-account-id': '6639c874c7f7d84a8b8584c3',
        'x-entity-id': 'ALM_BUSINESS',
        'x-entity-type': 'B2B',
        'Content-Type': 'application/json',
      },
      data: {
        contact: { firstName: 'shams', lastName: 'alafeef', email: '1234.fff@seera.sa', phone: '795526408', title: 'Ms' },
        payment: { paymentMethod: 'checkoutcom' },
        products: [{ product: { type: 'flight', category: 'flight', name: 'scenario3-flight', code: 'flight1' }, type: 'flight' }],
      },
    },
    prepareSaleCheckout: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/${encodeURIComponent(saleId)}/prepare`,
      headers: {
        'app-id': String(runtime.appId || '1034'),
        'x-user-id': '5e69da2bbd561a45621a42d3',
        'x-user-email': 's.ssss@hhh.comfff',
        'x-currency': 'SAR',
        'x-user-account-role': 'user',
        'x-b2b-account-id': '64db14f54490953ed3d22476',
        'x-entity-id': 'ALM',
        'x-entity-type': 'B2B',
        'Content-Type': 'application/json',
      },
      data: PREPARE_CHECKOUT_BODY_TEMPLATE,
      required: ['saleId'],
    },
    checkoutSale: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/${encodeURIComponent(saleId)}/checkout`,
      headers: { 'Content-Type': 'application/json' },
      data: PREPARE_CHECKOUT_BODY_TEMPLATE,
      required: ['saleId'],
    },
  };

  const reqConfig = map[stepId];
  if (!reqConfig) throw new Error(`Unknown stepId: ${stepId}`);
  if (['addFlightProduct', 'addHotelProduct'].includes(stepId) && !hasValidCartId) {
    throw new Error('Valid cartId is required. Run "Create Empty Cart" first.');
  }
  if (Array.isArray(reqConfig.required)) {
    for (const key of reqConfig.required) {
      if (!String(runtime[key] || '').trim()) {
        throw new Error(`${key} is required for ${stepId}`);
      }
    }
  }
  const finalConfig = {
    method: override.method || reqConfig.method,
    url: override.url || reqConfig.url,
    headers: { ...sharedHeaders, ...(reqConfig.headers || {}), ...(override.headers || {}) },
    params: override.params || {},
    data: Object.prototype.hasOwnProperty.call(override, 'data') ? override.data : reqConfig.data,
  };
  finalConfig.headers = {
    ...finalConfig.headers,
    'app-id': '50',
    'x-currency': 'SAR',
    'x-user-email': 'nabeel.seera@yahoo.com',
    'x-user-id': '5e69da2bbd561a45621a42d3',
    'Content-Type': 'application/json',
  };

  // Protect against stale "<cart-id>" or encoded placeholder in editable override URL.
  if (['addFlightProduct', 'addHotelProduct'].includes(stepId)) {
    let url = String(finalConfig.url || '');
    if (cartId) {
      url = url.replace(/<cart-id>/gi, cartId).replace(/%3Ccart-id%3E/gi, cartId);
      url = url.replace(/\/cart\/[^/]+/i, `/cart/${encodeURIComponent(cartId)}`);
    }
    if (/<cart-id>/i.test(url) || /%3Ccart-id%3E/i.test(url)) {
      throw new Error('Invalid cartId placeholder detected in request URL. Run "Create Empty Cart" first.');
    }
    finalConfig.url = url;
  }

  return finalConfig;
}

function detectRuntimeFromResponse(data) {
  const text = JSON.stringify(data || {});
  const cartMatch = text.match(/cart-[a-z0-9-]{8,}/i);
  const saleMatch = text.match(/sl-[a-z0-9-]{8,}/i);
  let totalToBePaid = null;
  try {
    const stack = [data];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(current, 'totalToBePaid')) {
        const n = Number(current.totalToBePaid);
        if (Number.isFinite(n)) {
          totalToBePaid = n;
          break;
        }
      }
      if (Array.isArray(current)) {
        current.forEach((x) => stack.push(x));
      } else {
        Object.values(current).forEach((x) => stack.push(x));
      }
    }
  } catch {
    totalToBePaid = null;
  }
  return {
    cartId: cartMatch ? cartMatch[0] : null,
    saleId: saleMatch ? saleMatch[0] : null,
    totalToBePaid,
  };
}

function resolveLookupRequest({ environment, lookupType, value }) {
  const cfg = getOmsLookupConfig(environment);
  const encoded = encodeURIComponent(String(value || '').trim());
  switch (lookupType) {
    case 'orderNumber':
      return {
        url: `${cfg.saleServiceBase}/sale/order-number/${encoded}`,
        params: { 'response-format': 'sdk' },
        headers: {},
      };
    case 'orderId':
      return {
        url: `${cfg.orderServiceBase}/order/id/${encoded}`,
        params: { 'response-format': 'sdk' },
        headers: {},
      };
    case 'cartId':
      return {
        url: `${cfg.cartServiceBase}/cart/${encoded}`,
        params: {},
        headers: {
          accept: 'application/json',
          'app-id': '50',
          'x-include-total-with-vat': 'true',
          'x-skip-expiry-check': 'false',
        },
      };
    case 'saleId':
      return {
        url: `${cfg.saleServiceBase}/sale/${encoded}`,
        params: {},
        headers: {},
      };
    case 'couponCodes':
      return {
        url: `${cfg.pricingCoreServiceBase}/coupon`,
        params: {},
        headers: {},
      };
    default:
      throw new Error('lookupType must be one of: orderNumber, orderId, cartId, saleId, couponCodes');
  }
}

function resolveBusinessScenarioStep({ environment, step, saleId, cartId, appId }) {
  const cfg = getOmsLookupConfig(environment);
  const safeSaleId = encodeURIComponent(String(saleId || '').trim());
  const safeCartId = encodeURIComponent(String(cartId || '').trim());
  const safeAppId = String(appId || '').trim() || '50';

  switch (step) {
    case 'createCart':
      return {
        method: 'post',
        url: `${cfg.cartServiceBase}/cart`,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        data: {},
      };
    case 'prepare':
      if (!safeCartId) throw new Error('cartId is required for prepare step');
      return {
        method: 'get',
        url: `${cfg.cartServiceBase}/cart/${safeCartId}/prepare`,
        headers: { accept: 'application/json', 'app-id': safeAppId },
        params: {},
        data: undefined,
      };
    case 'checkout':
      if (!safeSaleId) throw new Error('saleId is required for checkout step');
      return {
        method: 'post',
        url: `${cfg.saleServiceBase}/sale/${safeSaleId}/checkout`,
        headers: { 'Content-Type': 'application/json' },
        params: {},
        data: {},
      };
    default:
      throw new Error('step must be one of: createCart, prepare, checkout');
  }
}

/**
 * POST /api/logger/narrative
 * Body: { tracerId: string, environment: "dev" | "staging" }
 *
 * Returns:
 * {
 *   tracerId: string,
 *   environment: string,
 *   story: string,
 *   logs: LogEntry[]
 * }
 */
router.post('/narrative', async (req, res, next) => {
  try {
    const { tracerId, environment } = req.body;

    if (!tracerId || typeof tracerId !== 'string' || tracerId.trim() === '') {
      return res.status(400).json({ error: 'tracerId is required and must be a non-empty string.' });
    }

    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }

    const logs = await fetchLogs(tracerId.trim(), env);
    const [narrativeResult, mathValidationResult] = await Promise.allSettled([
      generateNarrative(logs),
      validateLogsMathWithGemini(logs),
    ]);

    const narrative = narrativeResult.status === 'fulfilled'
      ? narrativeResult.value
      : {
          story: 'Narrative generation timed out. Logs were fetched successfully; retry to regenerate AI narrative.',
          insights: null,
          provider: 'fallback',
          reason: narrativeResult.reason?.message || 'narrative generation failed',
        };
    const mathResult = mathValidationResult.status === 'fulfilled'
      ? mathValidationResult.value
      : {
          mathValidation: {
            summary: { ok: false, pairCount: 0, mismatchCount: 0, logsCompared: 0 },
            byLog: [],
          },
          provider: 'deterministic',
          reason: mathValidationResult.reason?.message || 'math validation failed',
        };

    return res.json({
      tracerId: tracerId.trim(),
      environment: env,
      story: narrative.story,
      insights: narrative.insights || null,
      aiProvider: narrative.provider || 'fallback',
      aiReason: narrative.reason || null,
      mathValidation: mathResult.mathValidation,
      mathProvider: mathResult.provider || 'deterministic',
      mathReason: mathResult.reason || null,
      logs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/logger/lookup
 * Body: { environment: "dev" | "staging", lookupType: "orderNumber" | "orderId" | "cartId" | "saleId" | "couponCodes", value?: string }
 */
router.post('/lookup', async (req, res, next) => {
  try {
    const { environment, lookupType, value } = req.body || {};
    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }
    const needsValue = lookupType !== 'couponCodes';
    if (needsValue && (!value || typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({ error: 'value is required and must be a non-empty string.' });
    }

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

    return res.json({
      environment: env,
      lookupType,
      value: typeof value === 'string' ? value.trim() : '',
      sourceUrl: reqConfig.url,
      data: response.data,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data || null;
    return res.status(status).json({
      error: err.message || 'Lookup failed',
      details,
    });
  }
});

/**
 * POST /api/logger/coupon-conflicts
 * Body: {
 *   environment: "dev" | "staging",
 *   newCoupon: object
 * }
 */
router.post('/coupon-conflicts', async (req, res) => {
  try {
    const { environment, newCoupon } = req.body || {};
    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }
    if (!newCoupon || typeof newCoupon !== 'object' || Array.isArray(newCoupon)) {
      return res.status(400).json({ error: 'newCoupon is required and must be a JSON object.' });
    }

    const result = await checkCouponConflicts({ environment: env, newCoupon });
    return res.json({
      environment: env,
      ...result,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    return res.status(status).json({
      error: err.message || 'Coupon conflict check failed',
      details: err?.response?.data || null,
    });
  }
});

/**
 * POST /api/logger/promotion-risk
 * Body: { environment: "dev" | "staging", newRule: string, activeRules: string }
 */
router.post('/promotion-risk', async (req, res) => {
  try {
    const { environment, newRule, activeRules } = req.body || {};
    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }
    if (!newRule || typeof newRule !== 'string' || !newRule.trim()) {
      return res.status(400).json({ error: 'newRule is required and must be a non-empty string.' });
    }
    if (!activeRules || typeof activeRules !== 'string' || !activeRules.trim()) {
      return res.status(400).json({ error: 'activeRules is required and must be a non-empty string.' });
    }

    const simulation = await simulatePromotionRisk({
      environment: env,
      newRule: newRule.trim(),
      activeRules: activeRules.trim(),
    });

    return res.json({
      environment: env,
      provider: simulation.provider,
      reason: simulation.reason,
      result: simulation.result,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Promotion risk simulation failed' });
  }
});

/**
 * POST /api/logger/business-scenario-step
 * Body: { environment: "dev" | "staging", step: "createCart" | "prepare" | "checkout", cartId?: string, saleId?: string, appId?: string }
 */
router.post('/business-scenario-step', async (req, res) => {
  try {
    const { environment, step, saleId, cartId, appId } = req.body || {};
    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }
    if (!step || typeof step !== 'string') {
      return res.status(400).json({ error: 'step is required.' });
    }

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

    return res.json({
      environment: env,
      step: step.trim(),
      sourceUrl: reqConfig.url,
      data: response.data,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    return res.status(status).json({
      error: err.message || 'Business scenario step failed',
      details: err?.response?.data || null,
    });
  }
});

router.get('/fast-track/scenarios', (req, res) => {
  return res.json({ scenarios: FAST_TRACK_SCENARIOS });
});

router.get('/fast-track/templates/add-flight-product-body', (req, res) => {
  return res.json({ body: ADD_FLIGHT_PRODUCT_BODY_TEMPLATE });
});

router.get('/fast-track/templates/add-hotel-product-body', (req, res) => {
  return res.json({ body: ADD_HOTEL_PRODUCT_BODY_TEMPLATE });
});

router.get('/fast-track/templates/prepare-body', (req, res) => {
  return res.json({ body: PREPARE_CHECKOUT_BODY_TEMPLATE });
});

router.post('/fast-track/execute', async (req, res) => {
  try {
    const { environment, stepId, runtime, override } = req.body || {};
    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }
    if (!stepId || typeof stepId !== 'string') {
      return res.status(400).json({ error: 'stepId is required.' });
    }

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

    return res.json({
      environment: env,
      stepId: stepId.trim(),
      responseStatus: response.status,
      responseHeaders: response.headers || {},
      responseBody: response.data,
      runtimeHints: detectRuntimeFromResponse(response.data),
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    return res.status(status).json({
      error: err.message || 'Fast-track step failed',
      details: err?.response?.data || null,
    });
  }
});

module.exports = router;
