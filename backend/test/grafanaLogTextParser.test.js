const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseGrafanaLogText } = require('../src/services/grafanaLogTextParser');

describe('grafanaLogTextParser', () => {
  it('parses a JSON array of OMS logs', () => {
    const logs = parseGrafanaLogText(
      JSON.stringify([
        {
          serviceName: 'PRICING-CALCULATOR',
          requestURI: '/apply/on-cart',
          outputResponse: { body: { rules: [] } },
        },
      ]),
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].serviceName, 'PRICING-CALCULATOR');
    assert.equal(logs[0]._source, 'grafana-paste');
  });

  it('parses JSON lines copied from Grafana', () => {
    const line = JSON.stringify({
      serviceName: 'ORDER-SERVICE',
      outputResponse: { body: { totals: { total: 100 } } },
    });
    const logs = parseGrafanaLogText(`${line}\n${line}`);
    assert.equal(logs.length, 2);
  });

  it('wraps plain text lines', () => {
    const logs = parseGrafanaLogText('payment failed: totals mismatch\nHTTP 500 on checkout');
    assert.equal(logs.length, 2);
    assert.match(logs[0].message, /payment failed/);
    assert.equal(logs[0]._source, 'grafana-paste');
  });

  it('extracts embedded JSON from a log line prefix', () => {
    const payload = JSON.stringify({ serviceName: 'CART-SERVICE', statusCode: 200 });
    const logs = parseGrafanaLogText(`2026-06-11T12:00:00Z info ${payload}`);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].serviceName, 'CART-SERVICE');
  });
});
