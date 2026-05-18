import { describe, expect, it } from 'vitest';
import { getNumberByKeys, moneyLabel, toMoney } from './money';

describe('money domain helpers', () => {
  it('formats currency labels', () => {
    expect(moneyLabel(10, 'SAR')).toBe('10.00 SAR');
  });

  it('rounds safely', () => {
    expect(toMoney(10.123456)).toBe(10.1235);
  });

  it('extracts first numeric key', () => {
    expect(getNumberByKeys({ a: 'x', b: '12.5' }, ['a', 'b'])).toBe(12.5);
  });
});
