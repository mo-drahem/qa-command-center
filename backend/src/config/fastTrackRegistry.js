const { badRequest } = require('../lib/httpError');
const { getOmsLookupConfig } = require('./oms');
const { fastTrackIdentityDefaults } = require('./fastTrackDefaults');
const { getExampleFixtures } = require('../lib/exampleFixtures');
const { cartProductHeaders, sharedCartHeaders } = require('../lib/cartHeaders');
const {
  newCartWithProductHeaders,
  buildNewCartWithProductBody,
} = require('../lib/newCartWithProduct');

function assertAllowedFastTrackUrl(url, environment) {
  const { URL } = require('url');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw badRequest('Invalid override URL.');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw badRequest('Only http/https protocols are allowed in override URL.');
  }
  const expectedSuffix = environment === 'staging' ? '.tajawal-staging.internal' : '.tajawal-dev.internal';
  if (!parsed.hostname.endsWith(expectedSuffix)) {
    throw badRequest(`override.url host must end with ${expectedSuffix}.`);
  }
}

function buildFastTrackStepRequest({ environment, stepId, runtime = {}, override = {} }) {
  const cfg = getOmsLookupConfig(environment);
  const defaults = fastTrackIdentityDefaults;
  const appId = String(runtime.appId || defaults.appId).trim();
  const cartId = String(runtime.cartId || '').trim();
  const saleId = String(runtime.saleId || '').trim();
  const sharedHeaders = sharedCartHeaders(runtime);
  const { addFlightProductBody, addHotelProductBody, prepareCheckoutBody, applyCouponBody } =
    getExampleFixtures();

  const map = {
    createEmptyCart: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart`,
      headers: { ...sharedHeaders, 'x-user-phone': defaults.userPhone },
      data: { type: 'flight', isManual: true, isManualOrder: true },
    },
    createEmptyCartHotel: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart`,
      headers: { ...sharedHeaders, 'x-user-phone': defaults.userPhone },
      data: { type: 'hotel', isManual: true, isManualOrder: true },
    },
    newCartWithFlightProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/newCartWithProduct`,
      headers: newCartWithProductHeaders(runtime),
      data: buildNewCartWithProductBody('flight'),
    },
    newCartWithHotelProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/newCartWithProduct`,
      headers: newCartWithProductHeaders(runtime),
      data: buildNewCartWithProductBody('hotel'),
    },
    addFlightProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/product`,
      headers: cartProductHeaders(runtime),
      data: addFlightProductBody,
      required: ['cartId'],
    },
    addHotelProduct: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/product`,
      headers: cartProductHeaders(runtime),
      data: addHotelProductBody,
      required: ['cartId'],
    },
    applyCouponToCart: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/apply/on-cart`,
      headers: sharedHeaders,
      data: applyCouponBody,
      required: ['cartId'],
    },
    prepareCart: {
      method: 'get',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/prepare`,
      headers: { accept: 'application/json', 'app-id': appId },
      data: undefined,
      required: ['cartId'],
    },
    checkoutCart: {
      method: 'post',
      url: `${cfg.cartServiceBase}/cart/${encodeURIComponent(cartId)}/checkout`,
      headers: sharedHeaders,
      data: prepareCheckoutBody,
      required: ['cartId'],
    },
    createSaleWithFlightProduct: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/create-list-products`,
      headers: sharedHeaders,
      data: {
        contact: { firstName: 'QA', lastName: 'User', email: defaults.userEmail, phone: defaults.userPhone, title: 'Ms' },
        payment: { paymentMethod: 'checkoutcom' },
        products: [{ product: { type: 'flight', category: 'flight', name: 'scenario3-flight', code: 'flight1' }, type: 'flight' }],
      },
    },
    createSaleWithHotelProduct: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/create-list-products`,
      headers: sharedHeaders,
      data: {
        contact: { firstName: 'QA', lastName: 'User', email: defaults.userEmail, phone: defaults.userPhone, title: 'Ms' },
        payment: { paymentMethod: 'checkoutcom' },
        products: [{ product: { type: 'hotel', category: 'hotel', name: 'scenario4-hotel', code: 'hotel1' }, type: 'hotel' }],
      },
    },
    prepareSaleCheckout: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/${encodeURIComponent(saleId)}/prepare`,
      headers: sharedHeaders,
      data: prepareCheckoutBody,
      required: ['saleId'],
    },
    checkoutSale: {
      method: 'post',
      url: `${cfg.saleServiceBase}/sale/${encodeURIComponent(saleId)}/checkout`,
      headers: { 'Content-Type': 'application/json' },
      data: prepareCheckoutBody,
      required: ['saleId'],
    },
  };

  const reqConfig = map[stepId];
  if (!reqConfig) throw badRequest(`Unknown stepId: ${stepId}`);
  if (Array.isArray(reqConfig.required)) {
    reqConfig.required.forEach((key) => {
      if (!String(runtime[key] || '').trim()) throw badRequest(`${key} is required for ${stepId}`);
    });
  }

  const merged = {
    method: override.method || reqConfig.method,
    url: override.url || reqConfig.url,
    headers: { ...reqConfig.headers, ...(override.headers || {}) },
    params: override.params || {},
    data: Object.prototype.hasOwnProperty.call(override, 'data') ? override.data : reqConfig.data,
  };
  assertAllowedFastTrackUrl(merged.url, environment);
  return merged;
}

function detectRuntimeFromResponse(data) {
  const text = JSON.stringify(data || {});
  const cartMatch = text.match(/cart-[a-z0-9-]{8,}/i);
  const saleMatch = text.match(/sl-[a-z0-9-]{8,}/i);
  const lockMatch = text.match(/couponLockId["\s:]+([a-zA-Z0-9-]+)/i);
  const ruleIdMatch =
    text.match(/"_id"\s*:\s*"([a-f0-9]{24})"/i) ||
    text.match(/"ruleId"\s*:\s*"([a-f0-9]{24})"/i) ||
    text.match(/"id"\s*:\s*"([a-f0-9]{24})"/i);
  let totalToBePaid = null;
  const totalMatch = text.match(/"totalToBePaid"\s*:\s*([0-9.]+)/i) || text.match(/"total"\s*:\s*([0-9.]+)/i);
  if (totalMatch) {
    const n = Number(totalMatch[1]);
    if (Number.isFinite(n)) totalToBePaid = n;
  }
  return {
    cartId: cartMatch ? cartMatch[0] : null,
    saleId: saleMatch ? saleMatch[0] : null,
    totalToBePaid,
    couponLockId: lockMatch ? lockMatch[1] : null,
    ruleId: ruleIdMatch ? ruleIdMatch[1] : null,
  };
}

module.exports = {
  assertAllowedFastTrackUrl,
  buildFastTrackStepRequest,
  detectRuntimeFromResponse,
};
