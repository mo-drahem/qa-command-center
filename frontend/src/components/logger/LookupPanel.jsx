import { useState } from 'react';
import toast from 'react-hot-toast';
import { lookupOmsData } from '../../api/loggerApi';
import { getActualResponseBody } from '../../domain/json';
import { JsonViewerCard } from './JsonViewer';

const LOOKUP_PLACEHOLDERS = {
  orderNumber: 'e.g. A2604074010750',
  orderId: 'e.g. order-22c40134-470c-4e42-b6ff-7920804df8bb',
  cartId: 'e.g. cart-3f5a2160-ffd1-4059-bddc-730c678cd026',
  saleId: 'e.g. sl-923f008b-9deb-4bcc-bce2-32489d0a741a',
  couponCodes: '(no value needed)',
};

export default function LookupPanel({ onOpenPromotions, initialType, initialValue }) {
  const [lookupEnvironment, setLookupEnvironment] = useState('dev');
  const [lookupType, setLookupType] = useState(initialType || 'orderNumber');
  const [lookupValue, setLookupValue] = useState(initialValue || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupApiPayload, setLookupApiPayload] = useState(null);
  const [lookupApiStatus, setLookupApiStatus] = useState('success');

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
        lookupType === 'couponCodes' ? '' : lookupValue.trim(),
      );
      setLookupResult(data);
      setLookupApiPayload(data);
      setLookupApiStatus('success');
      toast.success('Lookup completed!');
    } catch (err) {
      const payload = err.response?.data || { error: err.message || 'Lookup failed.' };
      setLookupApiPayload(payload);
      setLookupApiStatus('error');
      toast.error(payload?.error || 'Lookup failed.');
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
              placeholder={LOOKUP_PLACEHOLDERS[lookupType]}
              disabled={lookupType === 'couponCodes'}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        {lookupType === 'couponCodes' && onOpenPromotions && (
          <button
            type="button"
            onClick={onOpenPromotions}
            className="text-sm text-blue-600 hover:underline"
          >
            Open Promotions tab to browse coupons →
          </button>
        )}
        <button
          type="submit"
          disabled={lookupLoading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm"
        >
          {lookupLoading ? 'Fetching…' : 'Fetch Data'}
        </button>
      </form>

      {lookupLoading && (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
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
          <JsonViewerCard title="Lookup API Envelope" status={lookupApiStatus} payload={lookupApiPayload} />
        </>
      )}
    </div>
  );
}
