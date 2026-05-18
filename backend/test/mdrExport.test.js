const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildBusinessActionDraft } = require('../src/config/businessActionRegistry');

describe('getMdrOfRule headers', () => {
  it('does not send multipart content-type on GET', () => {
    const { draft } = buildBusinessActionDraft({
      environment: 'dev',
      actionId: 'getMdrOfRule',
      runtime: { ruleId: '6a0996c6f81d20586f29f59c' },
    });
    assert.ok(draft.headers.Accept);
    assert.equal(draft.headers['content-type'], undefined);
  });
});
