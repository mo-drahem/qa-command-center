const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildNewCartWithProductBody } = require('../src/lib/newCartWithProduct');

describe('buildNewCartWithProductBody', () => {
  it('returns flight payload with type, product, contact, payment', () => {
    const body = buildNewCartWithProductBody('flight');
    assert.equal(body.type, 'flight');
    assert.ok(body.product);
    assert.ok(body.contact);
    assert.ok(body.payment);
    assert.equal(body.isManual, true);
  });

  it('returns hotel payload with type hotel', () => {
    const body = buildNewCartWithProductBody('hotel');
    assert.equal(body.type, 'hotel');
    assert.equal(body.product.pricingRules.type, 'hotel');
  });
});
