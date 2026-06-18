const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  compactTraceForAi,
  buildNarrativePrompt,
  buildStoryFromInsights,
} = require('../src/services/aiNarrative');

describe('aiNarrative', () => {
  it('compactTraceForAi includes JSON payloads and masks sensitive fields', () => {
    const entries = compactTraceForAi([
      {
        serviceName: 'PRICING-CALCULATOR',
        requestURI: '/apply/on-cart',
        timestamp: '2026-01-01T00:00:00Z',
        duration: 120,
        inputRequest: { couponCode: 'SAVE10', card: { cvv: '123', number: '4111111111111111' } },
        outputResponse: {
          headers: { 'x-test': '1' },
          body: { rules: [{ name: 'RULE_A', value: 5, success: true }] },
        },
      },
    ]);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].serviceName, 'PRICING-CALCULATOR');
    assert.equal(entries[0].inputRequest.card.cvv, '***');
    assert.equal(entries[0].inputRequest.card.number, '***');
    assert.deepEqual(entries[0].outputResponse.body.rules[0].name, 'RULE_A');
    assert.equal(entries[0].outputResponse.headers, undefined);
  });

  it('buildNarrativePrompt embeds focus instructions and trace JSON', () => {
    const trace = compactTraceForAi([
      {
        serviceName: 'ORDER-SERVICE',
        requestURI: '/order/id/abc',
        outputResponse: { body: { totals: { total: 100 } } },
      },
    ]);
    const prompt = buildNarrativePrompt(trace, 'Check VAT only');

    assert.match(prompt, /USER FOCUS INSTRUCTIONS/);
    assert.match(prompt, /Check VAT only/);
    assert.match(prompt, /TRACE_JSON:/);
    assert.match(prompt, /ORDER-SERVICE/);
  });

  it('buildStoryFromInsights renders extended validation sections', () => {
    const story = buildStoryFromInsights({
      conclusion: 'PASS — checkout totals are consistent.',
      overviewPoints: ['Flow completed'],
      requestList: ['POST /checkout -> 200'],
      vitalData: ['totalAmount=100'],
      pricingRuleCouponDetails: ['Call 1: rule=RULE_A'],
      vatValidation: ['flightVat: 15 | 15 | PASS'],
      totalsValidation: ['PASS: grandTotals.total | 100 | 100 | 0'],
      anomalies: ['none'],
    });

    assert.match(story, /### Conclusion/);
    assert.match(story, /### Narrative Story/);
    assert.match(story, /### VAT Validation/);
    assert.match(story, /### Totals Validation/);
    assert.match(story, /flightVat: 15 \| 15 \| PASS/);
  });
});
