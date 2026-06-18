import { moneyLabel } from '../../domain/money';
import { buildReconciliationCards, detectCurrency, humanizeComparedLabel } from '../../domain/reconciliation';

export function StatChip({ label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

export function StoryCard({ story }) {
  if (!story) return null;

  const lines = story.split('\n');

  function copyStory() {
    navigator.clipboard?.writeText(story).catch(() => {});
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-700">📖 QA Narrative</h2>
        <button
          type="button"
          onClick={copyStory}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Copy markdown
        </button>
      </div>
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

export function CallsTable({ logs }) {
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

export function CriticalAlert({ mathValidation, currency }) {
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

export function TimelinePanel({ logs }) {
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

export function MathValidationPanel({
  mathValidation,
  mathProvider,
  mathReason,
  deterministicValidation,
}) {
  if (!mathValidation?.byLog?.length) return null;

  const { summary, byLog } = mathValidation;
  const rows = byLog.filter((e) => e.status !== 'skipped');

  if (rows.length === 0) return null;

  const detSummary = deterministicValidation?.summary;

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-2">🔢 Totals, tax &amp; line pricing</h2>
      {(mathProvider || mathReason) && (
        <p className="text-xs text-gray-500 mb-2">
          Provider: <span className="font-semibold">{mathProvider || 'deterministic'}</span>
          {mathReason ? ` — ${mathReason}` : ''}
        </p>
      )}
      {detSummary && mathProvider === 'gemini' && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
          Deterministic baseline: {detSummary.mismatchCount} mismatch(es), {detSummary.pairCount} pair(s).
        </p>
      )}
      <p className="text-xs text-gray-500 mb-4">
        Validates money fields (totals, VAT, line items, products pricing). Request↔response pairs and roll-up checks.
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

export function FinancialReconciliationReport({ logs, mathValidation, result }) {
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

export function VitalDataPanel({ vitalData, onLookup }) {
  if (!vitalData || vitalData.length === 0) return null;

  function tryLookup(item) {
    if (!onLookup) return;
    const text = String(item);
    const cart = text.match(/cart-[a-z0-9-]{8,}/i)?.[0];
    const sale = text.match(/sl-[a-z0-9-]{8,}/i)?.[0];
    if (cart) onLookup('cartId', cart);
    else if (sale) onLookup('saleId', sale);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">🔎 Vital Data</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {vitalData.map((item, i) => {
          const clickable = /cart-|sl-/i.test(String(item));
          return (
            <button
              key={i}
              type="button"
              onClick={() => tryLookup(item)}
              disabled={!clickable || !onLookup}
              className={`text-left text-sm text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 break-all ${
                clickable && onLookup ? 'hover:border-blue-300 cursor-pointer' : ''
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CurlPreview({ tracerId, environment }) {
  const baseByEnv = {
    dev: 'http://oms-v3-logging-service.tajawal-dev.internal',
    staging: 'http://oms-v3-logging-service.tajawal-staging.internal',
    production: 'http://oms-v3-logging-service.tajawal-prod-apps.internal',
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
