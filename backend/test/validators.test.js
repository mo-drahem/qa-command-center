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
  it('requires tracerId or logs for narrative', async () => {
    await assert.rejects(() => runMiddleware(validateNarrativePayload, { tracerId: '  ' }));
    await assert.rejects(() => runMiddleware(validateNarrativePayload, {}));
    await runMiddleware(validateNarrativePayload, { tracerId: 'abc' });
    await runMiddleware(validateNarrativePayload, { logs: [{ serviceName: 'TEST' }] });
  });

  it('allows logText without tracerId', async () => {
    await runMiddleware(validateNarrativePayload, { logText: 'error line from grafana' });
    await assert.rejects(() => runMiddleware(validateNarrativePayload, { logText: '   ' }));
  });

  it('allows grafana source with tracerId or grafanaQuery', async () => {
    await runMiddleware(validateNarrativePayload, { source: 'grafana', tracerId: 'abc' });
    await runMiddleware(validateNarrativePayload, { source: 'grafana', grafanaQuery: '{job="oms"}' });
    await assert.rejects(() => runMiddleware(validateNarrativePayload, { source: 'grafana' }));
  });

  it('validates narrative focusPrompt', async () => {
    await runMiddleware(validateNarrativePayload, { tracerId: 'abc', focusPrompt: 'check VAT' });
    await assert.rejects(() =>
      runMiddleware(validateNarrativePayload, { tracerId: 'abc', focusPrompt: 123 }),
    );
    await assert.rejects(() =>
      runMiddleware(validateNarrativePayload, { tracerId: 'abc', focusPrompt: 'x'.repeat(2001) }),
    );
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
