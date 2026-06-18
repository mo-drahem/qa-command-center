const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLokiStreams,
  buildLogqlFromTracer,
} = require('../src/services/grafanaLokiApi');

describe('grafanaLokiApi', () => {
  it('buildLogqlFromTracer substitutes tracer id', () => {
    const query = buildLogqlFromTracer('{job="oms"} |~ "{{tracerId}}"', 'trace-abc');
    assert.equal(query, '{job="oms"} |~ "trace-abc"');
  });

  it('normalizeLokiStreams maps OMS JSON log lines', () => {
    const logs = normalizeLokiStreams({
      data: {
        result: [
          {
            stream: { service: 'PRICING-CALCULATOR', job: 'oms' },
            values: [
              [
                '1710000000000000000',
                JSON.stringify({
                  serviceName: 'PRICING-CALCULATOR',
                  requestURI: '/apply/on-cart',
                  inputRequest: { couponCode: 'SAVE10' },
                  outputResponse: { body: { rules: [{ name: 'RULE_A', value: 5 }] } },
                }),
              ],
            ],
          },
        ],
      },
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0].serviceName, 'PRICING-CALCULATOR');
    assert.equal(logs[0]._source, 'grafana');
    assert.equal(logs[0].inputRequest.couponCode, 'SAVE10');
  });

  it('normalizeLokiStreams wraps plain text lines', () => {
    const logs = normalizeLokiStreams({
      data: {
        result: [
          {
            stream: { app: 'checkout' },
            values: [['1710000000000000000', 'payment failed: totals mismatch']],
          },
        ],
      },
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0].serviceName, 'checkout');
    assert.match(logs[0].message, /payment failed/);
  });
});
