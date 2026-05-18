const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  substituteRuntimeInUrl,
  validateRequiredRuntime,
  hasRuntimeRuleId,
} = require('../src/lib/runtimePlaceholders');

describe('runtimePlaceholders', () => {
  it('substitutes rule-id into URL path', () => {
    const url =
      'http://oms-v2-pricing-mdr-service.tajawal-dev.internal/mdr/export-csv/<rule-id>';
    const ruleId = '6a0996c6f81d20586f29f59c';
    const out = substituteRuntimeInUrl(url, { ruleId });
    assert.match(out, new RegExp(`/mdr/export-csv/${ruleId}$`));
  });

  it('validateRequiredRuntime flags missing or invalid rule-id', () => {
    const action = { requiresRuntime: ['ruleId'] };
    const ruleId = '6a0996c6f81d20586f29f59c';
    assert.equal(hasRuntimeRuleId({ ruleId }), true);
    assert.equal(hasRuntimeRuleId({ ruleId: 'RULE-ABC' }), false);
    assert.deepEqual(validateRequiredRuntime(action, { ruleId: '' }), ['ruleId']);
    assert.deepEqual(validateRequiredRuntime(action, { ruleId }), []);
  });
});
