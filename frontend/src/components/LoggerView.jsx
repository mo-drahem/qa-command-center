import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  executeFastTrackStep,
  getAddHotelProductBodyTemplate,
  generateNarrative,
  getAddFlightProductBodyTemplate,
  getPrepareBodyTemplate,
  getFastTrackScenarios,
  lookupOmsData,
} from '../api/loggerApi';

function JsonNode({ name, value, depth = 0, defaultExpandDepth = 1, resetKey = 0 }) {
  const isObject = value && typeof value === 'object';
  const isArray = Array.isArray(value);
  const indentStyle = { paddingLeft: `${Math.min(depth * 12, 48)}px` };

  if (!isObject) {
    const rendered =
      typeof value === 'string' ? `"${value}"` : value === null ? 'null' : String(value);
    const valueClass =
      typeof value === 'string'
        ? 'text-emerald-700'
        : typeof value === 'number'
          ? 'text-blue-700'
          : typeof value === 'boolean'
            ? 'text-purple-700'
            : 'text-gray-700';
    return (
      <div style={indentStyle} className="font-mono text-xs leading-5 break-all">
        {name !== undefined && <span className="text-gray-500">{name}: </span>}
        <span className={valueClass}>{rendered}</span>
      </div>
    );
  }

  const entries = isArray
    ? value.map((v, i) => [i, v])
    : Object.entries(value);

  return (
    <details key={`${resetKey}-${name || 'root'}-${depth}`} style={indentStyle} defaultOpen={depth <= defaultExpandDepth}>
      <summary className="cursor-pointer font-mono text-xs text-gray-700 leading-5">
        {name !== undefined ? `${name}: ` : ''}
        {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
      </summary>
      <div className="mt-1">
        {entries.map(([k, v]) => (
          <JsonNode
            key={String(k)}
            name={String(k)}
            value={v}
            depth={depth + 1}
            defaultExpandDepth={defaultExpandDepth}
            resetKey={resetKey}
          />
        ))}
      </div>
    </details>
  );
}

function JsonViewerCard({ title, status, payload }) {
  const [viewerType, setViewerType] = useState('code');

  if (payload === null || payload === undefined) return null;
  const badgeClass =
    status === 'error'
      ? 'bg-red-100 text-red-700'
      : 'bg-green-100 text-green-700';
  const jsonText = JSON.stringify(payload, null, 2) || '';
  const jsonLines = jsonText ? jsonText.split('\n') : [];
  const lineCount = jsonLines.length;
  const defaultExpandDepth = 1;
  const resetKey = 0;

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
            {status === 'error' ? 'Error Response' : 'Success Response'}
          </span>
          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            {lineCount} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewerType('code')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              viewerType === 'code' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setViewerType('tree')}
            className={`px-2 py-1 rounded text-xs font-medium ${
              viewerType === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Tree
          </button>
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[500px] overflow-auto">
        {viewerType === 'tree' ? (
          <JsonNode value={payload} depth={0} defaultExpandDepth={defaultExpandDepth} resetKey={resetKey} />
        ) : (
          <div className="font-mono text-xs leading-5">
            {jsonLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[56px_1fr] gap-3">
                <span className="text-right text-gray-400 select-none pr-2 border-r border-gray-200">
                  {idx + 1}
                </span>
                <span className="text-gray-800 whitespace-pre break-all">{line || ' '}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getActualResponseBody(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'object') return payload;

  // Common API wrapper conventions
  if (payload.body !== undefined) return payload.body;
  if (payload.data !== undefined) return payload.data;
  if (payload.response !== undefined) return payload.response;

  return payload;
}

function StatChip({ label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function StoryCard({ story }) {
  if (!story) return null;

  // Convert simple markdown-ish text to rendered lines for readability
  const lines = story.split('\n');

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">📖 QA Narrative</h2>
      <div className="max-w-none text-gray-700 text-sm leading-relaxed space-y-1 bg-gray-50 border border-gray-100 rounded-xl p-4">
        {lines.map((line, i) => {
          const normalized = line.trimStart();
          if (normalized.startsWith('## ') || normalized.startsWith('### ')) {
            const isMainSection = normalized.startsWith('## ');
            return (
              <div key={i} className={isMainSection ? 'pt-3' : 'pt-2'}>
                <p className={`${isMainSection ? 'text-base' : 'text-sm'} font-bold text-gray-900`}>
                  {normalized.replace(/^#{2,3} /, '')}
                </p>
              </div>
            );
          }
          if (normalized.startsWith('- ') || normalized.startsWith('* ')) {
            const indent = line.length - normalized.length;
            const isNested = indent >= 2;
            return (
              <p
                key={i}
                className={`${isNested ? 'ml-8 text-gray-600' : 'ml-4 text-gray-800'} font-mono`}
              >
                • {normalized.slice(2)}
              </p>
            );
          }
          if (line.trim() === '') {
            return <div key={i} className="h-1" />;
          }
          return (
            <p key={i} className="text-gray-700 font-mono">
              {normalized}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function CallsTable({ logs }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">📡 Calls Captured</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs bg-gray-50">
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Request URI</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => {
              const isError = Number(log.statusCode) >= 400;
              return (
                <tr
                  key={i}
                  className={`border-b border-gray-100 ${isError ? 'bg-red-50/70' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 pr-4 font-medium text-gray-800">
                    {log.serviceName || '—'}
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-600 break-all">
                    {log.requestURI || '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        isError
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {log.statusCode || '—'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    {log.timestamp || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseJsonMaybe(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function moneyLabel(value, currency = 'SAR') {
  const n = toMoney(value);
  if (n === null) return '—';
  return `${n.toFixed(2)} ${currency}`;
}

function findArrayByNames(root, names) {
  if (!root || typeof root !== 'object') return null;
  for (const name of names) {
    if (Array.isArray(root[name])) return root[name];
  }
  const wrappers = ['data', 'result', 'payload', 'pricing', 'response'];
  for (const w of wrappers) {
    const child = root[w];
    if (child && typeof child === 'object') {
      for (const name of names) {
        if (Array.isArray(child[name])) return child[name];
      }
    }
  }
  return null;
}

function getNumberByKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractPayload(log) {
  return (
    parseJsonMaybe(log?.outputResponse) ||
    parseJsonMaybe(log?.response) ||
    parseJsonMaybe(log?.responseBody) ||
    parseJsonMaybe(log?.data) ||
    parseJsonMaybe(log?.result) ||
    parseJsonMaybe(log?.inputRequest)
  );
}

function detectCurrency(result, fallback = 'SAR') {
  const vital = result?.insights?.vitalData || [];
  const hit = vital.find((v) => /currency=/i.test(v));
  if (!hit) return fallback;
  const val = hit.split('=')[1]?.trim();
  return val || fallback;
}

function buildReconciliationCards(logs, currency) {
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

function humanizeComparedLabel(path) {
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

function CriticalAlert({ mathValidation, currency }) {
  const rows = mathValidation?.byLog || [];
  const mismatch = rows
    .flatMap((r) => r.compared || [])
    .find((c) => c.path === '(error_message)' && c.match === false);
  if (!mismatch) return null;

  const pricingCalculated = Number(mismatch.requestValue);
  const requestSent = Number(mismatch.responseValue);
  const diff = Math.abs((Number.isFinite(pricingCalculated) ? pricingCalculated : 0) - (Number.isFinite(requestSent) ? requestSent : 0));

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-red-800 mb-1">Critical Alert</p>
      <p className="text-sm text-red-700">
        Mismatch Detected in Order Service: Request sent {moneyLabel(requestSent, currency)}, but Pricing Service calculated {moneyLabel(pricingCalculated, currency)}. Difference: {moneyLabel(diff, currency)}.
      </p>
    </div>
  );
}

function TimelinePanel({ logs }) {
  if (!logs?.length) return null;
  const mapAction = (uri) => {
    const u = String(uri || '');
    if (u.includes('/prepare')) return '💳 Checkout Attempt';
    if (u.includes('/on-cart')) return '🏷️ Price Calculation';
    if (u.includes('/logs/list')) return '📜 System Trace';
    return '📌 Service Step';
  };
  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">🧭 Chronological Timeline</h2>
      <ol className="relative border-s border-gray-200 ms-3 space-y-4">
        {logs.map((log, i) => {
          const isError = Number(log.statusCode) >= 400;
          const isSlow = Number(log.durationMs) > 500;
          return (
            <li key={i} className="ms-4">
              <span className={`absolute -start-2 mt-1 h-3 w-3 rounded-full ${isError ? 'bg-red-500' : isSlow ? 'bg-amber-500' : 'bg-green-500'}`} />
              <p className="text-sm font-medium text-gray-800">{mapAction(log.requestURI)}</p>
              <p className="text-xs text-gray-500">{log.serviceName || '—'} {log.timestamp ? `• ${log.timestamp}` : ''}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MathValidationPanel({ mathValidation }) {
  if (!mathValidation?.byLog?.length) return null;

  const { summary, byLog } = mathValidation;
  const rows = byLog.filter((e) => e.status !== 'skipped');

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-2">🔢 Totals, tax &amp; line pricing</h2>
      <p className="text-xs text-gray-500 mb-4">
        Validates money fields only (totals, display/grand totals, tax, prices, discounts). Runs line checks (qty×unit vs line total), roll-ups (Σ lines vs subTotal, subTotal+tax, total+VAT vs grand), and request↔response on matching paths. Parses <code className="bg-gray-100 px-1 rounded">a != b</code> in error bodies. Ignores status / app-id.
      </p>
      {summary && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-1 rounded text-xs font-semibold ${summary.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {summary.ok ? 'All checked pairs match' : `${summary.mismatchCount} mismatch(es)`}
          </span>
          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
            {summary.pairCount} path pair(s) compared
          </span>
          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
            {summary.logsCompared} log(s) with numbers
          </span>
        </div>
      )}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {rows.map((entry) => (
          <div
            key={entry.index}
            className={`border rounded-lg p-3 text-sm ${
              entry.status === 'mismatch' ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            <div className="font-medium text-gray-800 mb-1 flex items-center gap-2 flex-wrap">
              <span>#{entry.index + 1}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${entry.status === 'mismatch' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>
                {entry.status}
              </span>
              <span className="text-gray-500 font-normal">
                {entry.serviceName || '—'} — <span className="font-mono text-xs break-all">{entry.requestURI || '—'}</span>
              </span>
            </div>
            {entry.compared?.length > 0 && (
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {entry.compared.map((c, i) => (
                  <li
                    key={i}
                    className={c.match ? 'text-gray-700' : 'text-red-700 font-semibold'}
                  >
                    {c.type === 'formula'
                      ? `${humanizeComparedLabel(c.path)}: expected ${c.requestValue} vs actual ${c.responseValue}`
                      : `${humanizeComparedLabel(c.path)}: request ${c.requestValue} → response ${c.responseValue}`}
                    {!c.match && c.delta !== undefined && ` (Δ ${c.delta})`}
                    {c.note && ` — ${c.note}`}
                  </li>
                ))}
              </ul>
            )}
            {(entry.requestOnlyNumbers?.length > 0 || entry.responseOnlyNumbers?.length > 0) && (
              <details className="mt-2 text-xs text-gray-600">
                <summary className="cursor-pointer font-semibold text-gray-700">Technical Details</summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entry.requestOnlyNumbers?.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Request-only numbers</p>
                      <ul className="font-mono space-y-0.5">
                        {entry.requestOnlyNumbers.slice(0, 8).map((x, i) => (
                          <li key={i}>{x.path}={x.value}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {entry.responseOnlyNumbers?.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Response-only numbers</p>
                      <ul className="font-mono space-y-0.5">
                        {entry.responseOnlyNumbers.slice(0, 8).map((x, i) => (
                          <li key={i}>{x.path}={x.value}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialReconciliationReport({ logs, mathValidation, result }) {
  const currency = detectCurrency(result, 'SAR');
  const cards = buildReconciliationCards(logs, currency);
  if (!cards.length) return null;

  const primary = cards.find((c) => c.actualGrandTotal !== null) || cards[0];
  const promoFromData = (result?.insights?.vitalData || []).find((x) => /promo|rule|coupon/i.test(String(x)));
  const promoLabel = promoFromData ? promoFromData.split('=')[0] : 'Promo Code / Rule';
  const promoAmount = primary?.discounts ?? null;

  const mismatchRow = (mathValidation?.byLog || [])
    .flatMap((r) => r.compared || [])
    .find((c) => c.match === false);
  const pricingCalculated = Number(mismatchRow?.responseValue);
  const requestSent = Number(mismatchRow?.requestValue);
  const discrepancyAvailable = Number.isFinite(pricingCalculated) && Number.isFinite(requestSent);
  const difference = discrepancyAvailable ? Math.abs(pricingCalculated - requestSent) : null;

  const mismatchCount = Number(mathValidation?.summary?.mismatchCount || 0);
  const isFail = mismatchCount > 0;
  const summaryReason = isFail ? 'Price Mismatch' : 'Balanced';
  const summaryService = logs?.find((l) => /CHECKOUT/i.test(String(l?.serviceName || '')))?.serviceName || 'CHECKOUT';
  const slowServices = (logs || []).filter((l) => Number(l?.durationMs) > 500);

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4">
      <h2 className="text-lg font-semibold text-gray-700">🧾 Financial Reconciliation Report</h2>

      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isFail ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          Order: {isFail ? 'FAIL' : 'PASS'}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          Reason: {summaryReason}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          Service: {summaryService}
        </span>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Financial Waterfall</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2 text-gray-600">Subtotal from Cart Service</td>
                <td className="py-2 text-right font-medium">{moneyLabel(primary?.baseFare, currency)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 text-gray-600">{promoLabel}</td>
                <td className="py-2 text-right font-medium text-red-700">{promoAmount !== null && promoAmount !== undefined ? `- ${moneyLabel(promoAmount, currency)}` : '—'}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 text-gray-600">Transaction Fees</td>
                <td className="py-2 text-right font-medium text-amber-700">{primary?.surcharges !== null && primary?.surcharges !== undefined ? `+ ${moneyLabel(primary?.surcharges, currency)}` : '—'}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2 text-gray-600">Calculated VAT (15%)</td>
                <td className="py-2 text-right font-medium">{moneyLabel(primary?.calculatedVat, currency)}</td>
              </tr>
              <tr>
                <td className="py-2 font-bold text-gray-800">Expected Grand Total</td>
                <td className="py-2 text-right font-bold text-gray-900">{moneyLabel(primary?.expectedGrandTotal, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-700 font-semibold">Actual Grand Total</span>
          <span className={`font-semibold ${primary?.pass ? 'text-green-700' : 'text-red-700'}`}>
            {moneyLabel(primary?.actualGrandTotal, currency)}
          </span>
        </div>
      </div>

      {discrepancyAvailable && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800">System Discrepancy</p>
          <p className="text-sm text-red-700 mt-1">
            The client requested payment for {moneyLabel(requestSent, currency)}, but the OMS Business Logic requires {moneyLabel(pricingCalculated, currency)}.
          </p>
          <p className="text-xs text-red-700 mt-1">Difference: {moneyLabel(difference, currency)}</p>
        </div>
      )}

      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Service Health</h3>
        {slowServices.length === 0 ? (
          <p className="text-sm text-green-700">All services responded within 500ms.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {slowServices.map((s, i) => (
              <li key={i} className="text-amber-700">
                {s.serviceName || 'Service'} took {s.durationMs}ms {s.requestURI ? `(${s.requestURI})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VitalDataPanel({ vitalData }) {
  if (!vitalData || vitalData.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">🔎 Vital Data</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {vitalData.map((item, i) => (
          <p key={i} className="text-sm text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 break-all">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function CurlPreview({ tracerId, environment }) {
  const baseByEnv = {
    dev: 'http://oms-v3-logging-service.tajawal-dev.internal',
    staging: 'http://oms-v3-logging-service.tajawal-staging.internal',
  };

  const trimmedTracerId = tracerId.trim();
  const baseUrl = baseByEnv[environment] || baseByEnv.dev;
  const logsUrl = `${baseUrl}/logs/list?tracerId=${encodeURIComponent(trimmedTracerId)}`;
  const curlCommand = `curl --location '${logsUrl}'`;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-600 mb-2">Logs API curl preview</p>
      <textarea
        readOnly
        value={curlCommand}
        className="w-full min-h-20 rounded-md border border-gray-200 bg-white p-2 text-xs font-mono text-gray-700"
      />
    </div>
  );
}

function BusinessScenariosPanel({ environment, onEnvironmentChange }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('scenario1');
  const [cartIdInput, setCartIdInput] = useState('');
  const [saleIdInput, setSaleIdInput] = useState('');
  const [appIdInput, setAppIdInput] = useState('50');
  const [currencyInput, setCurrencyInput] = useState('SAR');
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [payloadByStep, setPayloadByStep] = useState({});
  const [responseByStep, setResponseByStep] = useState({});
  const [scenarioLoading, setScenarioLoading] = useState('');
  const [addFlightProductBodyTemplate, setAddFlightProductBodyTemplate] = useState(null);
  const [addHotelProductBodyTemplate, setAddHotelProductBodyTemplate] = useState(null);
  const [prepareCheckoutBodyTemplate, setPrepareCheckoutBodyTemplate] = useState(null);

  useEffect(() => {
    let mounted = true;
    getFastTrackScenarios()
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data?.scenarios) ? data.scenarios : [];
        setScenarios(list);
        if (list.length && !list.some((s) => s.id === selectedScenarioId)) {
          setSelectedScenarioId(list[0].id);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load fast-track scenarios.');
      });
    return () => {
      mounted = false;
    };
  }, [selectedScenarioId]);

  useEffect(() => {
    let mounted = true;
    getAddFlightProductBodyTemplate()
      .then((data) => {
        if (!mounted) return;
        if (data?.body && typeof data.body === 'object') {
          setAddFlightProductBodyTemplate(data.body);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load add-flight-product body template.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getAddHotelProductBodyTemplate()
      .then((data) => {
        if (!mounted) return;
        if (data?.body && typeof data.body === 'object') {
          setAddHotelProductBodyTemplate(data.body);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load add-hotel-product body template.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getPrepareBodyTemplate()
      .then((data) => {
        if (!mounted) return;
        if (data?.body && typeof data.body === 'object') {
          setPrepareCheckoutBodyTemplate(data.body);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load prepare/checkout body template.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) || null;
  const selectedSteps = Array.isArray(selectedScenario?.steps) ? selectedScenario.steps : [];

  function buildStepDraft(stepId) {
    const host =
      environment === 'staging'
        ? {
            cart: 'http://oms-v3-cart-service.tajawal-staging.internal',
            sale: 'http://oms-v3-sale-service.tajawal-staging.internal',
            checkout: 'http://oms-v2-checkout-service.tajawal-staging.internal',
          }
        : {
            cart: 'http://oms-v3-cart-service.tajawal-dev.internal',
            sale: 'http://oms-v3-sale-service.tajawal-dev.internal',
            checkout: 'http://oms-v2-checkout-service.tajawal-dev.internal',
          };

    const appId = '50';
    const cartId = cartIdInput || '<cart-id>';
    const saleId = saleIdInput || '<sale-id>';
    const currency = 'SAR';
    const userEmail = 'nabeel.seera@yahoo.com';
    const userId = '5e69da2bbd561a45621a42d3';

    const map = {
      createEmptyCart: {
        method: 'post',
        url: `${host.cart}/cart`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: { type: 'flight', isManual: true, isManualOrder: true },
      },
      createEmptyCartHotel: {
        method: 'post',
        url: `${host.cart}/cart`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: { type: 'hotel', isManual: true, isManualOrder: true },
      },
      addFlightProduct: {
        method: 'post',
        url: `${host.cart}/cart/${cartId}/product`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: addFlightProductBodyTemplate || {},
      },
      addHotelProduct: {
        method: 'post',
        url: `${host.cart}/cart/${cartId}/product`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: addHotelProductBodyTemplate || {},
      },
      createSaleWithFlightProduct: {
        method: 'post',
        url: `${host.sale}/sale/create-list-products`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: { contact: { firstName: 'QA', lastName: 'User', email: userEmail }, payment: { paymentMethod: 'checkoutcom' }, products: [{ product: { type: 'flight', category: 'flight' }, type: 'flight' }] },
      },
      prepareSaleCheckout: {
        method: 'post',
        url: `${host.sale}/sale/${saleId}/prepare`,
        headers: { 'app-id': appId, 'x-currency': currency, 'x-user-email': userEmail, 'x-user-id': userId, 'Content-Type': 'application/json' },
        data: {
          ...(prepareCheckoutBodyTemplate || {}),
          total: Number(totalInput || prepareCheckoutBodyTemplate?.total || 327.75),
        },
      },
      checkoutSale: {
        method: 'post',
        url: `${host.sale}/sale/${saleId}/checkout`,
        headers: { 'Content-Type': 'application/json' },
        data: {
          ...(prepareCheckoutBodyTemplate || {}),
          total: Number(totalInput || prepareCheckoutBodyTemplate?.total || 327.75),
        },
      },
    };
    return map[stepId] || { method: 'post', url: '', headers: {}, data: {} };
  }

  function getStepPayloadText(stepId) {
    if (payloadByStep[stepId] !== undefined) return payloadByStep[stepId];
    return JSON.stringify(buildStepDraft(stepId), null, 2);
  }

  function parseDraftSafe(text) {
    try {
      return JSON.parse(text || '{}');
    } catch {
      return null;
    }
  }

  function getQuickFieldsFromDraft(stepId) {
    const draft = parseDraftSafe(getStepPayloadText(stepId)) || {};
    const headers = draft?.headers && typeof draft.headers === 'object' ? draft.headers : {};
    const data = draft?.data && typeof draft.data === 'object' ? draft.data : {};
    const url = String(draft?.url || '');
    const cartFromUrl = (url.match(/\/cart\/([^/]+)/i) || [])[1] || '';
    const saleFromUrl = (url.match(/\/sale\/([^/]+)/i) || [])[1] || '';

    return {
      appId: String(headers['app-id'] ?? appIdInput ?? ''),
      currency: String(headers['x-currency'] ?? currencyInput ?? ''),
      userEmail: String(headers['x-user-email'] ?? userEmailInput ?? ''),
      userId: String(headers['x-user-id'] ?? userIdInput ?? ''),
      total: data?.total !== undefined && data?.total !== null ? String(data.total) : (totalInput || ''),
      cartId: String(data?.cartId ?? (cartFromUrl || cartIdInput || '')),
      saleId: String(saleFromUrl || saleIdInput || ''),
    };
  }

  function withUrlId(url, key, value) {
    const safeValue = String(value || '').trim();
    if (!safeValue) return url;
    if (key === 'cartId') return String(url || '').replace(/\/cart\/[^/]+/i, `/cart/${safeValue}`);
    if (key === 'saleId') return String(url || '').replace(/\/sale\/[^/]+/i, `/sale/${safeValue}`);
    return url;
  }

  function updateQuickField(stepId, key, value) {
    const current = parseDraftSafe(getStepPayloadText(stepId));
    if (!current) {
      toast.error(`JSON for step "${stepId}" is invalid. Fix JSON first.`);
      return;
    }
    const next = { ...current, headers: { ...(current.headers || {}) } };
    if (next.data && typeof next.data === 'object') next.data = { ...next.data };

    if (key === 'appId') next.headers['app-id'] = value;
    if (key === 'currency') next.headers['x-currency'] = value;
    if (key === 'userEmail') next.headers['x-user-email'] = value;
    if (key === 'userId') next.headers['x-user-id'] = value;
    if (key === 'total') {
      if (!next.data || typeof next.data !== 'object') next.data = {};
      const n = Number(value);
      next.data.total = Number.isFinite(n) ? n : value;
    }
    if (key === 'cartId') {
      next.url = withUrlId(next.url, 'cartId', value);
      if (next.data && typeof next.data === 'object' && Object.prototype.hasOwnProperty.call(next.data, 'cartId')) {
        next.data.cartId = value;
      }
      setCartIdInput(value);
    }
    if (key === 'saleId') {
      next.url = withUrlId(next.url, 'saleId', value);
      setSaleIdInput(value);
    }

    if (key === 'appId') setAppIdInput(value);
    if (key === 'currency') setCurrencyInput(value);
    if (key === 'userEmail') setUserEmailInput(value);
    if (key === 'userId') setUserIdInput(value);
    if (key === 'total') setTotalInput(value);

    setPayloadByStep((prev) => ({ ...prev, [stepId]: JSON.stringify(next, null, 2) }));
  }

  function patchStepTotal(stepId, totalValue) {
    const currentText = getStepPayloadText(stepId);
    const current = parseDraftSafe(currentText);
    if (!current) return;
    const next = { ...current };
    if (!next.data || typeof next.data !== 'object') next.data = {};
    next.data = { ...next.data, total: totalValue };
    setPayloadByStep((prev) => ({ ...prev, [stepId]: JSON.stringify(next, null, 2) }));
  }

  function patchStepCartId(stepId, cartIdValue) {
    const currentText = getStepPayloadText(stepId);
    const current = parseDraftSafe(currentText);
    if (!current) return;
    const next = { ...current };
    next.url = withUrlId(next.url, 'cartId', cartIdValue);
    if (next.data && typeof next.data === 'object' && !Array.isArray(next.data) && Object.prototype.hasOwnProperty.call(next.data, 'cartId')) {
      next.data = { ...next.data, cartId: cartIdValue };
    }
    setPayloadByStep((prev) => ({ ...prev, [stepId]: JSON.stringify(next, null, 2) }));
  }

  function forceReplaceCartIdPlaceholders(cartIdValue) {
    if (!cartIdValue) return;
    setPayloadByStep((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((stepKey) => {
        const raw = String(next[stepKey] || '');
        if (!raw) return;
        const replaced = raw
          .replace(/<cart-id>/g, cartIdValue)
          .replace(/"cartId"\s*:\s*"[^"]*"/g, `"cartId": "${cartIdValue}"`)
          .replace(/\/cart\/[^/"]+/gi, `/cart/${cartIdValue}`);
        next[stepKey] = replaced;
      });
      return next;
    });
  }

  function extractCartIdFromAny(payload) {
    const text = JSON.stringify(payload || {});
    const match = text.match(/cart-[a-z0-9-]{8,}/i);
    return match ? match[0] : '';
  }

  function patchDraftWithQuickFields(draft, stepId) {
    const out = { ...(draft || {}) };
    out.headers = { ...(out.headers || {}) };
    out.headers['app-id'] = '50';
    out.headers['x-currency'] = 'SAR';
    out.headers['x-user-email'] = 'nabeel.seera@yahoo.com';
    out.headers['x-user-id'] = '5e69da2bbd561a45621a42d3';
    out.headers['Content-Type'] = 'application/json';
    out.data = out.data && typeof out.data === 'object' ? { ...out.data } : out.data;
    if (out.data && typeof out.data === 'object' && totalInput.trim()) {
      const n = Number(totalInput.trim());
      if (Number.isFinite(n)) out.data.total = n;
    }
    return out;
  }

  async function runStep(stepId) {
    setScenarioLoading(stepId);
    try {
      const latestCreatedCartId =
        responseByStep.createEmptyCart?.payload?.runtimeHints?.cartId ||
        responseByStep.createEmptyCartHotel?.payload?.runtimeHints?.cartId ||
        extractCartIdFromAny(responseByStep.createEmptyCart?.payload) ||
        extractCartIdFromAny(responseByStep.createEmptyCartHotel?.payload) ||
        '';
      const effectiveCartId = String(latestCreatedCartId || cartIdInput || '').trim();
      const needsCartId = ['addFlightProduct', 'addHotelProduct'].includes(stepId);
      if (needsCartId && !/^cart-[a-z0-9-]{8,}$/i.test(effectiveCartId)) {
        toast.error('Valid cartId is required. Run "Create Empty Cart" first.');
        setScenarioLoading('');
        return;
      }

      if (effectiveCartId) {
        ['addFlightProduct', 'addHotelProduct']
          .forEach((stepKey) => patchStepCartId(stepKey, effectiveCartId));
      }

      const payloadText = getStepPayloadText(stepId);
      let override = {};
      try {
        override = payloadText.trim() ? JSON.parse(payloadText) : {};
      } catch {
        toast.error(`Invalid JSON payload for step "${stepId}".`);
        setScenarioLoading('');
        return;
      }
      override = patchDraftWithQuickFields(override, stepId);

      const data = await executeFastTrackStep(environment, stepId, {
        cartId: effectiveCartId,
        saleId: saleIdInput.trim(),
        appId: appIdInput.trim() || '50',
      }, override);

      setResponseByStep((prev) => ({
        ...prev,
        [stepId]: { status: 'success', payload: data },
      }));
      const nextCartId = String(
        data?.runtimeHints?.cartId ||
        extractCartIdFromAny(data) ||
        ''
      ).trim();
      if (nextCartId) {
        setCartIdInput(nextCartId);
        // Use create-cart / latest detected cart as default for all following cart-based steps.
        ['addFlightProduct', 'addHotelProduct']
          .forEach((stepKey) => patchStepCartId(stepKey, nextCartId));
        forceReplaceCartIdPlaceholders(nextCartId);
      }
      if (data?.runtimeHints?.saleId && !saleIdInput.trim()) setSaleIdInput(data.runtimeHints.saleId);
      if (Number.isFinite(Number(data?.runtimeHints?.totalToBePaid))) {
        const totalValue = Number(data.runtimeHints.totalToBePaid);
        setTotalInput(String(totalValue));
        ['prepareSaleCheckout', 'checkoutSale'].forEach((stepKey) => {
          patchStepTotal(stepKey, totalValue);
        });
      }
      toast.success(`Step "${stepId}" executed.`);
    } catch (err) {
      const payload = err.response?.data || { error: err.message || 'Step failed.' };
      setResponseByStep((prev) => ({
        ...prev,
        [stepId]: { status: 'error', payload },
      }));
      toast.error(payload?.error || 'Scenario step failed.');
    } finally {
      setScenarioLoading('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 sm:w-44">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioEnvironment">
              Environment
            </label>
            <select
              id="scenarioEnvironment"
              value={environment}
              onChange={(e) => onEnvironmentChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:w-64">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioType">
              Scenario
            </label>
            <select
              id="scenarioType"
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Fast-track runs multi-step test flows in minutes. `cartId` and `saleId` are auto-filled when detected.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioCartId">Cart ID</label>
            <input
              id="scenarioCartId"
              type="text"
              value={cartIdInput}
              onChange={(e) => setCartIdInput(e.target.value)}
              placeholder="cart-xxxx"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioSaleId">Sale ID</label>
            <input
              id="scenarioSaleId"
              type="text"
              value={saleIdInput}
              onChange={(e) => setSaleIdInput(e.target.value)}
              placeholder="sl-xxxx"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioAppId">App ID</label>
            <input
              id="scenarioAppId"
              type="text"
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value)}
              placeholder="50"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioCurrency">Currency</label>
            <input
              id="scenarioCurrency"
              type="text"
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
              placeholder="SAR"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioUserEmail">User Email</label>
            <input
              id="scenarioUserEmail"
              type="text"
              value={userEmailInput}
              onChange={(e) => setUserEmailInput(e.target.value)}
              placeholder="user@example.com"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioUserId">User ID</label>
            <input
              id="scenarioUserId"
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="user-id"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600" htmlFor="scenarioTotal">Total (optional)</label>
            <input
              id="scenarioTotal"
              type="text"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder="327.75"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {selectedSteps.map((step, index) => (
        <div key={step.id} className="bg-white rounded-2xl shadow p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{`Step ${index + 1}: ${step.title}`}</h3>
          <p className="text-xs text-gray-500 mt-1 font-mono">{step.id}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-2">Request JSON (editable)</p>
              <textarea
                value={getStepPayloadText(step.id)}
                onChange={(e) => {
                  const text = e.target.value;
                  setPayloadByStep((prev) => ({ ...prev, [step.id]: text }));
                  const parsed = parseDraftSafe(text);
                  if (parsed) {
                    const headers = parsed?.headers && typeof parsed.headers === 'object' ? parsed.headers : {};
                    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : {};
                    const url = String(parsed?.url || '');
                    const cartFromUrl = (url.match(/\/cart\/([^/]+)/i) || [])[1] || '';
                    const saleFromUrl = (url.match(/\/sale\/([^/]+)/i) || [])[1] || '';
                    const q = {
                      appId: String(headers['app-id'] ?? appIdInput ?? ''),
                      currency: String(headers['x-currency'] ?? currencyInput ?? ''),
                      userEmail: String(headers['x-user-email'] ?? userEmailInput ?? ''),
                      userId: String(headers['x-user-id'] ?? userIdInput ?? ''),
                      total: data?.total !== undefined && data?.total !== null ? String(data.total) : (totalInput || ''),
                      cartId: String(data?.cartId ?? (cartFromUrl || cartIdInput || '')),
                      saleId: String(saleFromUrl || saleIdInput || ''),
                    };
                    setAppIdInput(q.appId);
                    setCurrencyInput(q.currency);
                    setUserEmailInput(q.userEmail);
                    setUserIdInput(q.userId);
                    setTotalInput(q.total);
                    if (q.cartId) setCartIdInput(q.cartId);
                    if (q.saleId) setSaleIdInput(q.saleId);
                  }
                }}
                className="w-full min-h-56 rounded-md border border-gray-200 bg-white p-2 text-xs font-mono text-gray-700"
              />
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-2">Vital Data</p>
              <div className="grid grid-cols-1 gap-2">
                <input value={getQuickFieldsFromDraft(step.id).appId} onChange={(e) => updateQuickField(step.id, 'appId', e.target.value)} placeholder="app-id" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).cartId} onChange={(e) => updateQuickField(step.id, 'cartId', e.target.value)} placeholder="cartId" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).saleId} onChange={(e) => updateQuickField(step.id, 'saleId', e.target.value)} placeholder="saleId" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).currency} onChange={(e) => updateQuickField(step.id, 'currency', e.target.value)} placeholder="x-currency" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).userEmail} onChange={(e) => updateQuickField(step.id, 'userEmail', e.target.value)} placeholder="x-user-email" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).userId} onChange={(e) => updateQuickField(step.id, 'userId', e.target.value)} placeholder="x-user-id" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                <input value={getQuickFieldsFromDraft(step.id).total} onChange={(e) => updateQuickField(step.id, 'total', e.target.value)} placeholder="total" className="border border-gray-300 rounded px-2 py-1 text-xs" />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Two-way sync: edit here updates JSON, edit JSON updates these fields.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runStep(step.id)}
            disabled={Boolean(scenarioLoading)}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {scenarioLoading === step.id ? 'Running…' : 'Run Step'}
          </button>

          {responseByStep[step.id] && (
            <div className="mt-4 space-y-3">
              <JsonViewerCard
                title={`Step Response — ${step.title}`}
                status={responseByStep[step.id].status}
                payload={{
                  status: responseByStep[step.id].payload?.responseStatus ?? null,
                  headers: responseByStep[step.id].payload?.responseHeaders ?? {},
                  body: responseByStep[step.id].payload?.responseBody ?? responseByStep[step.id].payload,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LoggerView() {
  const [activeTab, setActiveTab] = useState('narrative');
  const [tracerId, setTracerId] = useState('');
  const [environment, setEnvironment] = useState('dev');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [lookupEnvironment, setLookupEnvironment] = useState('dev');
  const [lookupType, setLookupType] = useState('orderNumber');
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [narrativeApiPayload, setNarrativeApiPayload] = useState(null);
  const [narrativeApiStatus, setNarrativeApiStatus] = useState('success');
  const [lookupApiPayload, setLookupApiPayload] = useState(null);
  const [lookupApiStatus, setLookupApiStatus] = useState('success');
  const [scenarioEnvironment, setScenarioEnvironment] = useState('staging');

  const lookupPlaceholders = {
    orderNumber: 'e.g. A2604074010750',
    orderId: 'e.g. order-22c40134-470c-4e42-b6ff-7920804df8bb',
    cartId: 'e.g. cart-3f5a2160-ffd1-4059-bddc-730c678cd026',
    saleId: 'e.g. sl-923f008b-9deb-4bcc-bce2-32489d0a741a',
    couponCodes: '(no value needed)',
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (!tracerId.trim()) {
      toast.error('Please enter a Tracer ID.');
      return;
    }

    setLoading(true);
    setResult(null);
    setNarrativeApiPayload(null);

    try {
      const data = await generateNarrative(tracerId.trim(), environment);
      setResult(data);
      setNarrativeApiPayload(data);
      setNarrativeApiStatus('success');
      toast.success('Narrative generated!');
    } catch (err) {
      const payload = err.response?.data || { error: err.message || 'Failed to generate narrative.' };
      setNarrativeApiPayload(payload);
      setNarrativeApiStatus('error');
      const message =
        payload?.error ||
        err.message ||
        'Failed to generate narrative. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLookupSubmit(e) {
    e.preventDefault();
    if (lookupType !== 'couponCodes' && !lookupValue.trim()) {
      toast.error('Please enter a value.');
      return;
    }

    setLookupLoading(true);
    setLookupResult(null);
    setLookupApiPayload(null);
    try {
      const data = await lookupOmsData(
        lookupEnvironment,
        lookupType,
        lookupType === 'couponCodes' ? '' : lookupValue.trim()
      );
      setLookupResult(data);
      setLookupApiPayload(data);
      setLookupApiStatus('success');
      toast.success('Lookup completed!');
    } catch (err) {
      const payload = err.response?.data || { error: err.message || 'Lookup failed.' };
      setLookupApiPayload(payload);
      setLookupApiStatus('error');
      const message =
        payload?.error ||
        err.message ||
        'Lookup failed. Please try again.';
      toast.error(message);
    } finally {
      setLookupLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">🛠 QA Command Center</h1>
          <p className="mt-2 text-gray-500">Generate narrative reports or lookup OMS entities quickly.</p>
        </div>

        <div className="bg-white rounded-2xl shadow p-2 border border-gray-100 inline-flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('narrative')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === 'narrative' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Narrative Tool
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === 'lookup' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Data Lookup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('businessScenarios')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === 'businessScenarios' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Business Scenarios
          </button>
        </div>

        <div className={activeTab === 'narrative' ? 'block' : 'hidden'}>
            {/* Form card */}
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Environment selector */}
                <div className="flex flex-col gap-1 sm:w-40">
                  <label className="text-sm font-medium text-gray-600" htmlFor="environment">
                    Environment
                  </label>
                  <select
                    id="environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                  </select>
                </div>

                {/* Tracer ID input */}
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-sm font-medium text-gray-600" htmlFor="tracerId">
                    Tracer ID
                  </label>
                  <input
                    id="tracerId"
                    type="text"
                    value={tracerId}
                    onChange={(e) => setTracerId(e.target.value)}
                    placeholder="e.g. abc-123-xyz"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <CurlPreview tracerId={tracerId} environment={environment} />

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {loading ? 'Generating…' : 'Generate Story'}
              </button>
            </form>

            {/* Loading state */}
            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                <span className="ml-3 text-gray-500">Fetching logs and generating narrative…</span>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow p-4 border border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    {result.environment}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${result.aiProvider === 'copilot' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                    {result.aiProvider === 'copilot' ? 'Copilot analysis' : 'Heuristic fallback'}
                  </span>
                  <span className="text-gray-500 text-sm font-mono">Tracer: {result.tracerId}</span>
                </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatChip label="Calls" value={result.logs?.length ?? 0} />
                    <StatChip label="Math Pairs" value={result.mathValidation?.summary?.pairCount ?? 0} />
                    <StatChip label="Mismatches" value={result.mathValidation?.summary?.mismatchCount ?? 0} />
                    <StatChip label="Compared Logs" value={result.mathValidation?.summary?.logsCompared ?? 0} />
                  </div>
                </div>
                {result.aiReason && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {result.aiReason}
                  </p>
                )}
                <FinancialReconciliationReport logs={result.logs} mathValidation={result.mathValidation} result={result} />
                <TimelinePanel logs={result.logs} />
                <VitalDataPanel vitalData={result.insights?.vitalData} />
                <MathValidationPanel mathValidation={result.mathValidation} />
                <StoryCard story={result.story} />
                <CallsTable logs={result.logs} />
                <JsonViewerCard
                  title="Narrative Response Body (Smart JSON)"
                  status={narrativeApiStatus}
                  payload={getActualResponseBody(narrativeApiPayload)}
                />
                <JsonViewerCard
                  title="Narrative API Envelope"
                  status={narrativeApiStatus}
                  payload={narrativeApiPayload}
                />
              </div>
            )}
            {!loading && !result && narrativeApiPayload && (
              <>
                <JsonViewerCard
                  title="Narrative Response Body (Smart JSON)"
                  status={narrativeApiStatus}
                  payload={getActualResponseBody(narrativeApiPayload)}
                />
                <JsonViewerCard
                  title="Narrative API Envelope"
                  status={narrativeApiStatus}
                  payload={narrativeApiPayload}
                />
              </>
            )}
        </div>

        <div className={activeTab === 'lookup' ? 'block' : 'hidden'}>
            <form
              onSubmit={handleLookupSubmit}
              className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-600" htmlFor="lookupEnvironment">
                    Environment
                  </label>
                  <select
                    id="lookupEnvironment"
                    value={lookupEnvironment}
                    onChange={(e) => setLookupEnvironment(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-600" htmlFor="lookupType">
                    Input Type
                  </label>
                  <select
                    id="lookupType"
                    value={lookupType}
                    onChange={(e) => setLookupType(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="orderNumber">order number</option>
                    <option value="orderId">order id</option>
                    <option value="cartId">cart id</option>
                    <option value="saleId">sale id</option>
                    <option value="couponCodes">coupon codes</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-600" htmlFor="lookupValue">
                    Value
                  </label>
                  <input
                    id="lookupValue"
                    type="text"
                    value={lookupValue}
                    onChange={(e) => setLookupValue(e.target.value)}
                    placeholder={lookupPlaceholders[lookupType]}
                    disabled={lookupType === 'couponCodes'}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {lookupLoading ? 'Fetching…' : 'Fetch Data'}
              </button>
            </form>

            {lookupLoading && (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                <span className="ml-3 text-gray-500">Fetching OMS data…</span>
              </div>
            )}

            {lookupResult && !lookupLoading && (
              <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {lookupResult.environment}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {lookupResult.lookupType}
                  </span>
                  <span className="text-xs font-mono text-gray-500 break-all">value: {lookupResult.value}</span>
                </div>
                <p className="text-xs text-gray-500 break-all">source: {lookupResult.sourceUrl}</p>
              </div>
            )}
            {!lookupLoading && lookupApiPayload && (
              <>
                <JsonViewerCard
                  title="Lookup Response Body (Smart JSON)"
                  status={lookupApiStatus}
                  payload={getActualResponseBody(lookupApiPayload)}
                />
                <JsonViewerCard
                  title="Lookup API Envelope"
                  status={lookupApiStatus}
                  payload={lookupApiPayload}
                />
              </>
            )}
        </div>

        <div className={activeTab === 'businessScenarios' ? 'block' : 'hidden'}>
          <BusinessScenariosPanel
            environment={scenarioEnvironment}
            onEnvironmentChange={setScenarioEnvironment}
          />
        </div>

      </div>
    </div>
  );
}
