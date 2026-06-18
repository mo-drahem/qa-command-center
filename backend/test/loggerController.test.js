const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveLookupRequest, buildFastTrackStepRequest } = require('../src/controllers/loggerController');
const { assertAllowedFastTrackUrl } = require('../src/config/fastTrackRegistry');
describe('loggerController helpers', () => {
  it('resolveLookupRequest builds cart URL', () => {
    const cfg = resolveLookupRequest({ environment: 'dev', lookupType: 'cartId', value: 'cart-abc' });
    assert.match(cfg.url, /cart\/cart-abc/);
    assert.equal(cfg.headers['app-id'], '51');
  });

  it('resolveLookupRequest builds sale URL with required headers', () => {
    const cfg = resolveLookupRequest({
      environment: 'staging',
      lookupType: 'saleId',
      value: 'sl-bf48ff7a-6cb6-4670-9fbc-8ee8d7cc038a',
    });
    assert.match(cfg.url, /tajawal-staging\.internal\/sale\/sl-bf48ff7a/);
    assert.equal(cfg.headers['app-id'], undefined);
    assert.equal(cfg.headers['x-currency'], 'SAR');
    assert.equal(cfg.headers['x-skip-expiry-check'], 'true');
  });

  it('buildFastTrackStepRequest requires cartId for add product', () => {
    assert.throws(
      () => buildFastTrackStepRequest({ environment: 'dev', stepId: 'addFlightProduct', runtime: {} }),
      (err) => err.statusCode === 400,
    );
  });

  it('buildFastTrackStepRequest includes hotel sale step', () => {
    const req = buildFastTrackStepRequest({
      environment: 'staging',
      stepId: 'createSaleWithHotelProduct',
      runtime: {},
    });
    assert.match(req.url, /tajawal-staging\.internal/);
    assert.equal(req.data.products[0].type, 'hotel');
  });

  it('assertAllowedFastTrackUrl rejects external host', () => {
    assert.throws(
      () => assertAllowedFastTrackUrl('http://evil.example.com/cart', 'dev'),
      (err) => err.statusCode === 400,
    );
  });
});
