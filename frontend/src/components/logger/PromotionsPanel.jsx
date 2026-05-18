import { useState } from 'react';
import toast from 'react-hot-toast';
import { checkCouponConflicts, simulatePromotionRisk } from '../../api/loggerApi';
import { getActualResponseBody } from '../../domain/json';
import { JsonViewerCard } from './JsonViewer';

const DEFAULT_NEW_COUPON = `{
  "code": "QA_TEST_COUPON",
  "couponCode": ["QA_TEST_COUPON"],
  "condition": [
    {
      "operator": "gte",
      "cartVariable": "cartTotal",
      "value": "100"
    }
  ]
}`;

const DEFAULT_NEW_RULE =
  'New rule: 15% off flight products for cart total >= 500 SAR, stackable with member discount.';

const DEFAULT_ACTIVE_RULES =
  'Active: AUTO10 (10% cart-wide), VIP5 (5% for VIP segment), WELCOME50 (50 SAR fixed on first order).';

export default function PromotionsPanel({ environment, onEnvironmentChange, initialCouponJson }) {
  const [couponJson, setCouponJson] = useState(initialCouponJson || DEFAULT_NEW_COUPON);
  const [newRule, setNewRule] = useState(DEFAULT_NEW_RULE);
  const [activeRules, setActiveRules] = useState(DEFAULT_ACTIVE_RULES);
  const [couponLoading, setCouponLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [couponResult, setCouponResult] = useState(null);
  const [couponStatus, setCouponStatus] = useState('success');
  const [riskResult, setRiskResult] = useState(null);
  const [riskStatus, setRiskStatus] = useState('success');

  async function handleCouponCheck(e) {
    e.preventDefault();
    let newCoupon;
    try {
      newCoupon = JSON.parse(couponJson);
    } catch {
      toast.error('Invalid coupon JSON.');
      return;
    }
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const data = await checkCouponConflicts(environment, newCoupon);
      setCouponResult(data);
      setCouponStatus('success');
      const verdict = data?.analysis?.verdict;
      toast.success(verdict === 'BLOCK' ? 'Conflicts found — review findings.' : 'No critical conflicts.');
    } catch (err) {
      const payload = err.response?.data || { error: err.message };
      setCouponResult(payload);
      setCouponStatus('error');
      toast.error(payload?.error || 'Coupon conflict check failed.');
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleRiskSim(e) {
    e.preventDefault();
    if (!newRule.trim() || !activeRules.trim()) {
      toast.error('Both rule fields are required.');
      return;
    }
    setRiskLoading(true);
    setRiskResult(null);
    try {
      const data = await simulatePromotionRisk(environment, newRule.trim(), activeRules.trim());
      setRiskResult(data);
      setRiskStatus('success');
      toast.success(`Risk simulation complete (${data.provider}).`);
    } catch (err) {
      const payload = err.response?.data || { error: err.message };
      setRiskResult(payload);
      setRiskStatus('error');
      toast.error(payload?.error || 'Promotion risk simulation failed.');
    } finally {
      setRiskLoading(false);
    }
  }

  const findings = couponResult?.analysis?.findings || [];
  const summary = couponResult?.analysis?.summary;
  const edgeCases = riskResult?.result?.edgeCases || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Coupon conflict check</h2>
        <p className="text-sm text-gray-500">
          Compare a proposed coupon against active coupons in pricing-core (dev/staging).
        </p>
        <form onSubmit={handleCouponCheck} className="space-y-4">
          <div className="flex flex-col gap-1 sm:w-44">
            <label className="text-sm font-medium text-gray-600" htmlFor="promoEnv">
              Environment
            </label>
            <select
              id="promoEnv"
              value={environment}
              onChange={(e) => onEnvironmentChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600" htmlFor="newCouponJson">
              New coupon JSON
            </label>
            <textarea
              id="newCouponJson"
              value={couponJson}
              onChange={(e) => setCouponJson(e.target.value)}
              className="mt-1 w-full min-h-40 font-mono text-xs border border-gray-300 rounded-lg p-3"
            />
          </div>
          <button
            type="submit"
            disabled={couponLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm"
          >
            {couponLoading ? 'Checking…' : 'Check conflicts'}
          </button>
        </form>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                couponResult?.analysis?.verdict === 'BLOCK'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {couponResult.analysis.verdict}
            </span>
            <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              Scanned: {summary.scannedCoupons}
            </span>
            <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              Findings: {summary.totalFindings} (critical {summary.critical})
            </span>
          </div>
        )}
        {findings.length > 0 && (
          <ul className="space-y-2 text-sm">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`border rounded-lg p-3 ${
                  f.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}
              >
                <span className="font-semibold text-gray-800">{f.couponCode}</span>
                <span className="ml-2 text-xs uppercase text-gray-500">{f.type}</span>
                <p className="text-gray-700 mt-1">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
        {couponResult && (
          <JsonViewerCard
            title="Coupon conflict response"
            status={couponStatus}
            payload={getActualResponseBody(couponResult)}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Promotion risk simulation</h2>
        <form onSubmit={handleRiskSim} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600" htmlFor="newRule">
              New rule (description)
            </label>
            <textarea
              id="newRule"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              className="mt-1 w-full min-h-24 text-sm border border-gray-300 rounded-lg p-3"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600" htmlFor="activeRules">
              Active rules context
            </label>
            <textarea
              id="activeRules"
              value={activeRules}
              onChange={(e) => setActiveRules(e.target.value)}
              className="mt-1 w-full min-h-24 text-sm border border-gray-300 rounded-lg p-3"
            />
          </div>
          <button
            type="submit"
            disabled={riskLoading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg text-sm"
          >
            {riskLoading ? 'Simulating…' : 'Simulate risks'}
          </button>
        </form>
        {riskResult?.provider && (
          <p className="text-xs text-gray-500">
            Provider: {riskResult.provider}
            {riskResult.reason ? ` — ${riskResult.reason}` : ''}
          </p>
        )}
        {edgeCases.length > 0 && (
          <div className="space-y-2">
            {edgeCases.map((ec, i) => (
              <div
                key={i}
                className={`border rounded-lg p-3 text-sm ${
                  ec.severity === 'high'
                    ? 'border-red-200 bg-red-50'
                    : ec.severity === 'medium'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200'
                }`}
              >
                <p className="font-semibold text-gray-800">{ec.title}</p>
                <p className="text-gray-600 mt-1">{ec.scenario}</p>
                <p className="text-gray-700 mt-1">{ec.mathRisk}</p>
                <span className="text-xs uppercase text-gray-500">{ec.severity}</span>
              </div>
            ))}
          </div>
        )}
        {riskResult && (
          <JsonViewerCard
            title="Promotion risk response"
            status={riskStatus}
            payload={getActualResponseBody(riskResult?.result || riskResult)}
          />
        )}
      </div>
    </div>
  );
}
