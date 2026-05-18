const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeConflicts } = require('../src/services/couponConflictChecker');

describe('couponConflictChecker.analyzeConflicts', () => {
  it('blocks duplicate coupon code', () => {
    const existing = [{ code: 'SAVE10', couponCode: ['SAVE10'] }];
    const analysis = analyzeConflicts({ code: 'SAVE10', couponCode: ['SAVE10'] }, existing);
    assert.equal(analysis.verdict, 'BLOCK');
    assert.ok(analysis.findings.some((f) => f.type === 'duplicate_code'));
  });

  it('blocks overlapping conditions', () => {
    const condition = [{ operator: 'gte', cartVariable: 'cartTotal', value: '100' }];
    const existing = [{ code: 'OTHER', condition }];
    const analysis = analyzeConflicts({ code: 'NEW', condition }, existing);
    assert.equal(analysis.verdict, 'BLOCK');
    assert.ok(analysis.findings.some((f) => f.type === 'condition_match'));
  });

  it('allows safe coupon when no overlap', () => {
    const analysis = analyzeConflicts(
      { code: 'UNIQUE99', condition: [{ operator: 'eq', cartVariable: 'appId', value: '99' }] },
      [{ code: 'OTHER', condition: [{ operator: 'gte', cartVariable: 'cartTotal', value: '500' }] }],
    );
    assert.equal(analysis.verdict, 'SAFE_TO_PROCEED');
    assert.equal(analysis.findings.length, 0);
  });
});
