const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getExampleFixtures, parseCurlExport, resetExampleFixturesCache } = require('../src/lib/exampleFixtures');

describe('exampleFixtures', () => {
  it('loads flight and hotel product bodies from examples/', () => {
    resetExampleFixturesCache();
    const fixtures = getExampleFixtures();

    assert.ok(fixtures.addFlightProductBody?.product);
    assert.equal(fixtures.addFlightProductBody.product.pricingRules?.type, 'flight');
    assert.ok(fixtures.addHotelProductBody?.product);
    assert.equal(fixtures.addHotelProductBody.product.pricingRules?.type, 'hotel');
  });

  it('loads prepare and coupon bodies from examples/', () => {
    resetExampleFixturesCache();
    const fixtures = getExampleFixtures();

    assert.equal(fixtures.prepareCheckoutBody.type, 'flight');
    assert.ok(fixtures.prepareCheckoutBody.total);
    assert.equal(fixtures.applyCouponBody.couponCode, 'QA_TEST_COUPON');
    assert.ok(fixtures.fileNames.includes('prepare-checkout.json'));
    assert.ok(fixtures.fileNames.includes('apply-coupon-to-cart.json'));
  });

  it('extracts cart product headers from Bruno curl export', () => {
    resetExampleFixturesCache();
    const { cartProductExtraHeaders } = getExampleFixtures();

    assert.equal(cartProductExtraHeaders['x-user-account-role'], 'user');
    assert.equal(cartProductExtraHeaders['x-include-total-with-vat'], 'true');
  });

  it('parseCurlExport reads headers and JSON body', () => {
    const raw = `curl --location 'http://example.test/cart/cart-1/product' \\
--header 'app-id: 50' \\
--data-raw '{"product":{"type":"hotel"}}'`;
    const parsed = parseCurlExport(raw);
    assert.equal(parsed.url, 'http://example.test/cart/cart-1/product');
    assert.equal(parsed.headers['app-id'], '50');
    assert.equal(parsed.body.product.type, 'hotel');
  });
});
