const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fallbackSimulation } = require('../src/services/promotionRiskSimulator');

describe('promotionRiskSimulator.fallbackSimulation', () => {
  it('returns edge cases for coupon stacking text', () => {
    const result = fallbackSimulation('new 20% coupon', 'active auto 10% stackable promo');
    assert.ok(Array.isArray(result.edgeCases));
    assert.ok(result.edgeCases.length >= 3);
    assert.ok(result.criticalSignals.length >= 1);
  });

  it('returns generic risks when no keywords match', () => {
    const result = fallbackSimulation('rule A', 'rule B');
    assert.ok(result.summary.length >= 1);
    assert.ok(result.recommendation.length >= 1);
  });
});
