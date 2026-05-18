export function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function moneyLabel(value, currency = 'SAR') {
  const n = toMoney(value);
  if (n === null) return '—';
  return `${n.toFixed(2)} ${currency}`;
}

export function getNumberByKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
