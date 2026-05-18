const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateLogsMath } = require('../src/services/mathValidator');

describe('mathValidator', () => {
  it('matches identical totals between request and response', () => {
    const logs = [
      {
        serviceName: 'CART',
        requestURI: '/cart/x',
        inputRequest: JSON.stringify({ totals: { total: 100, subTotal: 86.96 } }),
        outputResponse: JSON.stringify({ data: { totals: { total: 100, subTotal: 86.96 } } }),
      },
    ];
    const result = validateLogsMath(logs);
    assert.equal(result.summary.ok, true);
    assert.equal(result.summary.mismatchCount, 0);
    assert.ok(result.summary.pairCount >= 2);
  });

  it('detects totals mismatch', () => {
    const logs = [
      {
        inputRequest: JSON.stringify({ totals: { total: 100 } }),
        outputResponse: JSON.stringify({ totals: { total: 99 } }),
      },
    ];
    const result = validateLogsMath(logs);
    assert.equal(result.summary.ok, false);
    assert.equal(result.summary.mismatchCount, 1);
  });

  it('flags currency mismatch from headers', () => {
    const logs = [
      {
        requestHeaders: { 'x-currency': 'SAR' },
        outputResponse: JSON.stringify({ currency: 'USD', totals: { total: 1 } }),
        inputRequest: JSON.stringify({ totals: { total: 1 } }),
      },
    ];
    const result = validateLogsMath(logs);
    const currencyRow = result.byLog[0].compared.find((c) => c.path === 'currency');
    assert.ok(currencyRow);
    assert.equal(currencyRow.match, false);
  });

  it('compares line item pricing when totals absent', () => {
    const logs = [
      {
        inputRequest: JSON.stringify({
          products: [{ pricing: { lineTotal: 50, unitPrice: 25 }, quantity: 2 }],
        }),
        outputResponse: JSON.stringify({
          products: [{ pricing: { lineTotal: 50, unitPrice: 25 }, quantity: 2 }],
        }),
      },
    ];
    const result = validateLogsMath(logs);
    assert.ok(result.summary.logsCompared >= 1);
    assert.equal(result.summary.ok, true);
  });
});
