/** Internal OMS host bases for dev/staging/production (QA tooling only). */
export function getOmsHosts(environment) {
  const env = String(environment || 'dev').toLowerCase();
  const suffix =
    env === 'staging' ? 'staging' : env === 'production' || env === 'prod' ? 'prod-apps' : 'dev';
  return {
    cart: `http://oms-v3-cart-service.tajawal-${suffix}.internal`,
    sale: `http://oms-v3-sale-service.tajawal-${suffix}.internal`,
    checkout: `http://oms-v2-checkout-service.tajawal-${suffix}.internal`,
    pricingCore: `http://oms-v2-pricing-core-service.tajawal-${suffix}.internal`,
    pricingMdr: `http://oms-v2-pricing-mdr-service.tajawal-${suffix}.internal`,
  };
}
