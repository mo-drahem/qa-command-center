const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateNarrativePayload,
  validateLookupPayload,
  validateFastTrackPayload,
} = require('../src/middleware/validators');

function runMiddleware(fn, body) {
  return new Promise((resolve, reject) => {
    const req = { body };
    const res = {};
    fn(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

describe('validators', () => {
  it('requires tracerId for narrative', async () => {
    await assert.rejects(() => runMiddleware(validateNarrativePayload, { tracerId: '  ' }));
    await runMiddleware(validateNarrativePayload, { tracerId: 'abc' });
  });

  it('allows couponCodes lookup without value', async () => {
    await runMiddleware(validateLookupPayload, { lookupType: 'couponCodes', value: '' });
    await assert.rejects(() => runMiddleware(validateLookupPayload, { lookupType: 'cartId', value: '' }));
  });

  it('requires stepId for fast-track', async () => {
    await assert.rejects(() => runMiddleware(validateFastTrackPayload, { stepId: '' }));
    await runMiddleware(validateFastTrackPayload, { stepId: 'createEmptyCart' });
  });
});
