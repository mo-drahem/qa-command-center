import { parseJsonMaybe } from './json';
import { getNumberByKeys, toMoney } from './money';

export function extractPayload(log) {
  return (
    parseJsonMaybe(log?.outputResponse) ||
    parseJsonMaybe(log?.response) ||
    parseJsonMaybe(log?.responseBody) ||
    parseJsonMaybe(log?.data) ||
    parseJsonMaybe(log?.result) ||
    parseJsonMaybe(log?.inputRequest)
  );
}

export function detectCurrency(result, fallback = 'SAR') {
  const vital = result?.insights?.vitalData || [];
  const hit = vital.find((v) => /currency=/i.test(v));
  if (!hit) return fallback;
  const val = hit.split('=')[1]?.trim();
  return val || fallback;
}

export function buildReconciliationCards(logs, currency) {
  const targets = (logs || []).filter((l) =>
    /PRICING-CALCULATOR|ORDER-SERVICE/i.test(String(l?.serviceName || '')),
  );

  const pickTotals = (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.totals && typeof payload.totals === 'object') return payload.totals;
    const wrappers = ['data', 'result', 'payload', 'response', 'pricing'];
    for (const w of wrappers) {
      if (payload[w] && typeof payload[w] === 'object' && payload[w].totals && typeof payload[w].totals === 'object') {
        return payload[w].totals;
      }
    }
    return null;
  };

  return targets
    .map((log) => {
      const payload = extractPayload(log);
      if (!payload) return null;
      const totals = pickTotals(payload);
      if (!totals) return null;

      const subtotal = getNumberByKeys(totals, ['subTotal', 'subtotal', 'cartSubtotal', 'baseFare', 'baseTotal']);
      const discounts = getNumberByKeys(totals, ['discount', 'discounts', 'totalDiscount', 'discountTotal']);
      const surcharges = getNumberByKeys(totals, ['surcharge', 'surcharges', 'fee', 'fees', 'transactionFee']);
      const tax = getNumberByKeys(totals, ['tax', 'taxAmount']);
      const vat = getNumberByKeys(totals, ['vat', 'vatAmount', 'totalVat']);
      const total = getNumberByKeys(totals, ['total', 'totalAmount', 'netTotal']);
      const totalWithVat = getNumberByKeys(totals, ['totalWithVat', 'totalWithVAT', 'grandTotal', 'displayTotal']);

      const subtotalForCalc =
        subtotal ??
        ((total ?? null) !== null
          ? (total ?? 0) - (tax ?? 0)
          : null);
      const calcVat = subtotalForCalc !== null ? subtotalForCalc * 0.15 : null;
      const expectedGrandTotal = subtotalForCalc !== null ? subtotalForCalc + (calcVat ?? 0) : null;
      const actualGrandTotal = totalWithVat ?? total ?? null;
      const delta =
        actualGrandTotal === null || expectedGrandTotal === null
          ? null
          : Math.abs(toMoney(actualGrandTotal - expectedGrandTotal));
      const pass = actualGrandTotal !== null && expectedGrandTotal !== null && (delta ?? 1) <= 0.0001;

      return {
        serviceName: log.serviceName || 'Unknown Service',
        requestURI: log.requestURI || '—',
        baseFare: subtotalForCalc,
        discounts,
        surcharges,
        calculatedVat: calcVat ?? vat ?? tax,
        expectedGrandTotal,
        actualGrandTotal,
        delta,
        pass,
        currency,
      };
    })
    .filter(Boolean);
}

export function humanizeComparedLabel(path) {
  if (!path) return 'Financial Value';
  if (path === '(error_message)') return 'Service Mismatch Message';
  const productMatch = path.match(/products\[(\d+)\].*?(tax|vat|basePrice|price|discount|lineTotal|total|unitPrice)/i);
  if (productMatch) {
    const idx = Number(productMatch[1]) + 1;
    const field = productMatch[2].toLowerCase();
    const map = {
      tax: 'Tax',
      vat: 'VAT',
      baseprice: 'Base Price',
      unitprice: 'Unit Price',
      price: 'Price',
      discount: 'Discount',
      linetotal: 'Line Total',
      total: 'Total',
    };
    return `Product ${idx} ${map[field] || 'Amount'}`;
  }
  if (/grandtotal|totalwithvat|totalwithvat|displaytotal/i.test(path)) return 'Grand Total';
  if (/subtotal/i.test(path)) return 'Subtotal';
  if (/discount/i.test(path)) return 'Discount';
  if (/tax|vat/i.test(path)) return 'Tax / VAT';
  if (/price/.test(path)) return 'Price';
  return path
    .replace(/\[\d+\]/g, '')
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
