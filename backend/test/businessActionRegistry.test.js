const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildBusinessActionDraft } = require('../src/config/businessActionRegistry');
const { fastTrackIdentityDefaults } = require('../src/config/fastTrackDefaults');

describe('buildBusinessActionDraft', () => {
  it('createNewRule uses pricing-core /rule with client-id header', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'createNewRule',
      runtime: {},
    });

    assert.equal(draft.method, 'post');
    assert.match(draft.url, /oms-v2-pricing-core-service\.tajawal-dev\.internal\/rule$/);
    assert.equal(draft.headers['client-id'], 'nibz');
    assert.equal(draft.headers['Content-Type'], 'application/json');
    assert.equal(draft.data.code, 'RULE-JCD5-JCD5');
    assert.equal(draft.data.promotionType, 'SERVICE_FEE');
    assert.equal(draft.data.action.amount, '60');
  });

  it('addFlightProductToCart draft uses examples/ product body', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'addFlightProductToCart',
      runtime: { cartId: 'cart-abc' },
    });

    assert.match(draft.url, /\/cart\/cart-abc\/product$/);
    assert.equal(draft.data.product.pricingRules.type, 'flight');
  });

  it('prepareCart draft is GET without body', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'prepareCart',
      runtime: { cartId: 'cart-abc', appId: '50' },
    });

    assert.equal(draft.method, 'get');
    assert.match(draft.url, /\/prepare$/);
    assert.equal(draft.data, undefined);
  });

  it('createCartWithFlightProduct uses POST /cart/newCartWithProduct', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'createCartWithFlightProduct',
      runtime: {},
    });

    assert.equal(draft.method, 'post');
    assert.match(draft.url, /\/cart\/newCartWithProduct$/);
    assert.equal(draft.data.type, 'flight');
    assert.ok(draft.data.product);
    assert.equal(draft.headers['x-entity-id'], 'ALM');
    assert.equal(draft.headers['x-user-phone'], fastTrackIdentityDefaults.userPhone);
  });

  it('getMdrOfRule draft uses pricing-mdr export-csv endpoint', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'getMdrOfRule',
      runtime: { ruleId: '6a0996c6f81d20586f29f59c' },
    });

    assert.equal(draft.method, 'get');
    assert.match(
      draft.url,
      /oms-v2-pricing-mdr-service\.tajawal-dev\.internal\/mdr\/export-csv\/6a0996c6f81d20586f29f59c$/,
    );
    assert.equal(draft.headers.Accept, 'text/csv, application/json, */*');
    assert.equal(draft.headers['content-type'], undefined);
  });

  it('createNewRule respects runtime clientId override', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'staging',
      actionId: 'createNewRule',
      runtime: { clientId: 'custom-client' },
    });

    assert.match(draft.url, /tajawal-staging\.internal\/rule$/);
    assert.equal(draft.headers['client-id'], 'custom-client');
  });
});
