import { describe, it, expect } from 'vitest';
import { buildReconciliationCards, detectCurrency } from './reconciliation';

describe('reconciliation', () => {
  it('detectCurrency reads vital data chip', () => {
    const currency = detectCurrency({ insights: { vitalData: ['currency=SAR', 'app-id=50'] } });
    expect(currency).toBe('SAR');
  });

  it('buildReconciliationCards from pricing calculator log', () => {
    const logs = [
      {
        serviceName: 'PRICING-CALCULATOR',
        outputResponse: JSON.stringify({
          totals: { subTotal: 100, totalWithVat: 115, discount: 5 },
        }),
      },
    ];
    const cards = buildReconciliationCards(logs, 'SAR');
    expect(cards.length).toBe(1);
    expect(cards[0].baseFare).toBe(100);
    expect(cards[0].actualGrandTotal).toBe(115);
  });
});
