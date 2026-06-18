import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  getPromotionCouponById,
  getPromotionCoupons,
  getPromotionMdr,
  getPromotionRuleById,
  getPromotionRules,
} from '../../api/loggerApi';
import { RULE_ID_EXAMPLE } from '../../domain/businessRequest';
import { getActualResponseBody } from '../../domain/json';
import { JsonViewerCard } from './JsonViewer';

const PROMO_TABS = [
  { id: 'rules', label: 'Get rules' },
  { id: 'ruleById', label: 'Get rule by id', input: 'ruleId' },
  { id: 'coupons', label: 'Get coupons' },
  { id: 'couponById', label: 'Get coupon by id', input: 'couponId' },
  { id: 'mdr', label: 'Get MDR of rule', input: 'ruleId' },
];

function responsePayload(result) {
  if (!result) return null;
  const body = result.data ?? result.responseBody ?? result;
  return {
    sourceUrl: result.sourceUrl,
    responseStatus: result.responseStatus,
    hint: result.hint,
    body,
  };
}

export default function PromotionsPanel({ environment, onEnvironmentChange }) {
  const [activeTab, setActiveTab] = useState('rules');
  const [ruleId, setRuleId] = useState('');
  const [couponId, setCouponId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('success');

  const activeConfig = PROMO_TABS.find((t) => t.id === activeTab);

  function switchTab(tabId) {
    setActiveTab(tabId);
    setResult(null);
  }

  async function handleSearch(e) {
    e?.preventDefault?.();
    const tab = PROMO_TABS.find((t) => t.id === activeTab);
    if (!tab) return;

    if (tab.input === 'ruleId' && !ruleId.trim()) {
      toast.error('Rule id is required.');
      return;
    }
    if (tab.input === 'couponId' && !couponId.trim()) {
      toast.error('Coupon id is required.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      let data;
      switch (activeTab) {
        case 'rules':
          data = await getPromotionRules(environment);
          break;
        case 'ruleById':
          data = await getPromotionRuleById(environment, ruleId.trim());
          break;
        case 'coupons':
          data = await getPromotionCoupons(environment);
          break;
        case 'couponById':
          data = await getPromotionCouponById(environment, couponId.trim());
          break;
        case 'mdr':
          data = await getPromotionMdr(environment, ruleId.trim());
          break;
        default:
          return;
      }
      setResult(data);
      setStatus(data.responseStatus >= 400 ? 'error' : 'success');
      if (data.responseStatus >= 400) {
        toast.error(`Request returned HTTP ${data.responseStatus}.`);
      } else {
        toast.success(`${tab.label} completed.`);
      }
    } catch (err) {
      const payload = err.response?.data || { error: err.message };
      setResult(payload);
      setStatus('error');
      toast.error(payload?.error || `${tab.label} failed.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Pricing promotions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Read rules, coupons, and MDR from pricing-core and pricing-mdr (dev/staging/production).
          </p>
        </div>

        <div className="p-2 flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50">
          {PROMO_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="p-6 space-y-4">
          <div className="flex flex-col gap-1 sm:max-w-xs">
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
              <option value="production">production</option>
            </select>
          </div>

          {activeConfig?.input === 'ruleId' && (
            <div className="flex flex-col gap-1 max-w-md">
              <label className="text-sm font-medium text-gray-600" htmlFor="promoRuleId">
                Rule id (24-char hex)
              </label>
              <input
                id="promoRuleId"
                type="text"
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value)}
                placeholder={RULE_ID_EXAMPLE}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {activeConfig?.input === 'couponId' && (
            <div className="flex flex-col gap-1 max-w-md">
              <label className="text-sm font-medium text-gray-600" htmlFor="promoCouponId">
                Coupon id
              </label>
              <input
                id="promoCouponId"
                type="text"
                value={couponId}
                onChange={(e) => setCouponId(e.target.value)}
                placeholder="e.g. coupon document id or code"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>

      {result && (
        <JsonViewerCard
          title={activeConfig?.label || 'Result'}
          status={status}
          payload={getActualResponseBody(responsePayload(result))}
        />
      )}
    </div>
  );
}
