const { badRequest } = require('../lib/httpError');

function normalizeEnvironment(environment) {
  const env = String(environment || 'dev').trim().toLowerCase();
  if (!['dev', 'staging'].includes(env)) {
    throw badRequest('environment must be "dev" or "staging".');
  }
  return env;
}

function getOmsLookupConfig(environment) {
  const env = normalizeEnvironment(environment);
  const hostSuffix = env === 'staging' ? 'staging' : 'dev';
  const { env: envVars } = require('./env');
  const defaults = {
    saleServiceBase: `http://oms-v3-sale-service.tajawal-${hostSuffix}.internal`,
    orderServiceBase: `http://oms-v2-order-service.tajawal-${hostSuffix}.internal`,
    cartServiceBase: `http://oms-v3-cart-service.tajawal-${hostSuffix}.internal`,
    checkoutServiceBase: `http://oms-v2-checkout-service.tajawal-${hostSuffix}.internal`,
    pricingCoreServiceBase: `http://oms-v2-pricing-core-service.tajawal-${hostSuffix}.internal`,
    pricingMdrServiceBase: `http://oms-v2-pricing-mdr-service.tajawal-${hostSuffix}.internal`,
  };
  return {
    saleServiceBase: envVars.OMS_SALE_SERVICE_BASE || defaults.saleServiceBase,
    orderServiceBase: envVars.OMS_ORDER_SERVICE_BASE || defaults.orderServiceBase,
    cartServiceBase: envVars.OMS_CART_SERVICE_BASE || defaults.cartServiceBase,
    checkoutServiceBase: envVars.OMS_CHECKOUT_SERVICE_BASE || defaults.checkoutServiceBase,
    pricingCoreServiceBase: envVars.OMS_PRICING_CORE_SERVICE_BASE || defaults.pricingCoreServiceBase,
    pricingMdrServiceBase: envVars.OMS_PRICING_MDR_SERVICE_BASE || defaults.pricingMdrServiceBase,
  };
}

module.exports = {
  normalizeEnvironment,
  getOmsLookupConfig,
};
