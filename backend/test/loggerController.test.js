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
