import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  executeBusinessAction,
  getBusinessActionDraft,
  getBusinessActions,
} from '../../api/loggerApi';
import { getVitalFieldsForAction } from '../../config/businessActionVitalFields';
import {
  applyVitalField,
  buildExecutePayload,
  extractVitalValues,
  parseJsonObject,
  runtimeFieldLabel,
  substituteRuntimeInUrl,
  validateRequiredRuntime,
  validateRuleIdFormat,
  RULE_ID_EXAMPLE,
  stringifyJson,
} from '../../domain/businessRequest';
import { JsonViewerCard } from './JsonViewer';

function applyDraftToState(draft) {
  const { note, composite, method, url, headers, data, ...rest } = draft || {};
  void note;
  void composite;
  void rest;
  return {
    method: method || 'GET',
    url: url || '',
    headers: headers && typeof headers === 'object' ? headers : {},
    body: data !== undefined && data !== null ? data : {},
    draftNote: draft?.note || '',
  };
}

export default function BusinessScenariosPanel({ environment, onEnvironmentChange }) {
  const [catalog, setCatalog] = useState({ categories: [], actions: [] });
  const [selectedActionId, setSelectedActionId] = useState('createCartWithFlightProduct');

  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('{}');
  const [bodyText, setBodyText] = useState('{}');
  const [vitalValues, setVitalValues] = useState({});
  const [draftNote, setDraftNote] = useState('');

  const [loadingDraft, setLoadingDraft] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [responseStatus, setResponseStatus] = useState('success');

  const [cartId, setCartId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [ruleId, setRuleId] = useState('');

  const runtime = useMemo(
    () => ({
      cartId: cartId.trim(),
      saleId: saleId.trim(),
      ruleId: ruleId.trim(),
    }),
    [cartId, saleId, ruleId],
  );

  const selectedAction = catalog.actions.find((a) => a.id === selectedActionId);
  const vitalFields = useMemo(() => getVitalFieldsForAction(selectedActionId), [selectedActionId]);
  const requiredRuntime = selectedAction?.requiresRuntime || [];
  const needsRuleId = requiredRuntime.includes('ruleId');
  const needsCartId = requiredRuntime.includes('cartId');
  const needsSaleId = requiredRuntime.includes('saleId');
  const resolvedUrl = useMemo(
    () => substituteRuntimeInUrl(url, runtime),
    [url, runtime],
  );

  const headersParse = parseJsonObject(headersText, {});
  const bodyParse = parseJsonObject(bodyText, {});
  const headersValid = headersParse.ok;
  const bodyValid = bodyParse.ok;

  const loadDraft = useCallback(async () => {
    if (!selectedActionId) return;
    setLoadingDraft(true);
    try {
      const data = await getBusinessActionDraft(environment, selectedActionId, runtime);
      const applied = applyDraftToState(data.draft);
      setMethod(applied.method.toUpperCase());
      setUrl(applied.url);
      setHeadersText(stringifyJson(applied.headers));
      setBodyText(stringifyJson(applied.body));
      setDraftNote(applied.draftNote);
      setVitalValues(extractVitalValues(vitalFields, applied.headers, applied.body));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load action draft.');
    } finally {
      setLoadingDraft(false);
    }
  }, [environment, selectedActionId, runtime, vitalFields]);

  useEffect(() => {
    let mounted = true;
    getBusinessActions()
      .then((data) => {
        if (!mounted) return;
        setCatalog({
          categories: data.categories || [],
          actions: data.actions || [],
        });
        if (data.actions?.length && !data.actions.some((a) => a.id === selectedActionId)) {
          setSelectedActionId(data.actions[0].id);
        }
      })
      .catch(() => toast.error('Failed to load business actions.'));
    return () => {
      mounted = false;
    };
  }, [selectedActionId]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const actionsByCategory = useMemo(() => {
    const map = {};
    catalog.categories.forEach((c) => {
      map[c.id] = catalog.actions.filter((a) => a.category === c.id);
    });
    return map;
  }, [catalog]);

  const bodyVitalFields = useMemo(
    () => vitalFields.filter((f) => f.target === 'body'),
    [vitalFields],
  );
  const headerVitalFields = useMemo(
    () => vitalFields.filter((f) => f.target === 'header'),
    [vitalFields],
  );

  function handleHeadersChange(text) {
    setHeadersText(text);
    const parsed = parseJsonObject(text, {});
    if (!parsed.ok) return;
    const body = bodyValid ? bodyParse.value : {};
    setVitalValues((prev) => ({
      ...prev,
      ...extractVitalValues(vitalFields, parsed.value, body),
    }));
  }

  function handleBodyChange(text) {
    setBodyText(text);
    const parsed = parseJsonObject(text, {});
    if (!parsed.ok) return;
    const headers = headersValid ? headersParse.value : {};
    setVitalValues((prev) => ({
      ...prev,
      ...extractVitalValues(vitalFields, headers, parsed.value),
    }));
  }

  function handleVitalChange(fieldId, value) {
    const headers = headersValid ? headersParse.value : {};
    const body = bodyValid ? bodyParse.value : {};
    const { headers: nextHeaders, body: nextBody } = applyVitalField(
      vitalFields,
      fieldId,
      value,
      headers,
      body,
    );
    setVitalValues((prev) => ({ ...prev, [fieldId]: value }));
    const field = vitalFields.find((f) => f.id === fieldId);
    if (field?.target === 'header') {
      setHeadersText(stringifyJson(nextHeaders));
    }
    if (field?.target === 'body') {
      setBodyText(stringifyJson(nextBody));
    }
  }

  async function handleExecute() {
    if (!headersValid) {
      toast.error(`Headers JSON invalid: ${headersParse.error}`);
      return;
    }
    if (!bodyValid) {
      toast.error(`Body JSON invalid: ${bodyParse.error}`);
      return;
    }
    if (!resolvedUrl.trim()) {
      toast.error('URL is missing. Reload the template or check runtime IDs.');
      return;
    }

    const missingRuntime = validateRequiredRuntime(selectedAction, runtime);
    if (missingRuntime.length > 0) {
      toast.error(
        `Required: ${missingRuntime.map(runtimeFieldLabel).join(', ')}. Enter ${missingRuntime.map(runtimeFieldLabel).join(' and ')} above.`,
      );
      return;
    }
    if (needsRuleId) {
      const ruleFormatError = validateRuleIdFormat(runtime);
      if (ruleFormatError) {
        toast.error(ruleFormatError);
        return;
      }
    }

    const payload = buildExecutePayload(
      method,
      resolvedUrl,
      headersParse.value,
      bodyParse.value,
    );

    setExecuting(true);
    setLastResponse(null);
    try {
      const data = await executeBusinessAction(environment, selectedActionId, runtime, payload);
      setLastResponse(data);
      const failed = data.responseStatus >= 400;
      setResponseStatus(failed ? 'error' : 'success');
      const hints = data.runtimeHints || {};
      if (hints.cartId) setCartId(hints.cartId);
      if (hints.saleId) setSaleId(hints.saleId);
      if (hints.ruleId) setRuleId(hints.ruleId);
      if (failed && data.hint) {
        toast.error(data.hint);
      } else if (failed) {
        toast.error(`Request failed (${data.responseStatus}).`);
      } else {
        toast.success(
          data.composite
            ? `Action completed (${data.steps?.length || 0} step(s)).`
            : 'Action completed.',
        );
      }
    } catch (err) {
      const errPayload = err.response?.data || { error: err.message || 'Action failed.' };
      setLastResponse(errPayload);
      setResponseStatus('error');
      toast.error(errPayload?.error || 'Action failed.');
    } finally {
      setExecuting(false);
    }
  }

  const hasBody = method !== 'GET';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Business Scenarios</h2>
          <p className="text-sm text-gray-500 mt-1">
            URL (fixed), headers, then request body and vital fields side by side — edits stay in
            sync both ways.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 sm:w-40">
            <label className="text-sm font-medium text-gray-600" htmlFor="bsEnvironment">
              Environment
            </label>
            <select
              id="bsEnvironment"
              value={environment}
              onChange={(e) => onEnvironmentChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <label className="text-sm font-medium text-gray-600" htmlFor="bsAction">
              Action
            </label>
            <select
              id="bsAction"
              value={selectedActionId}
              onChange={(e) => setSelectedActionId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {catalog.categories.map((cat) => (
                <optgroup key={cat.id} label={cat.label}>
                  {(actionsByCategory[cat.id] || []).map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {selectedAction && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            {selectedAction.description}
            {requiredRuntime.length > 0 && (
              <span className="block mt-1 text-amber-700">
                Required before run: {requiredRuntime.map(runtimeFieldLabel).join(', ')}
              </span>
            )}
          </p>
        )}

        {(needsCartId || needsSaleId || needsRuleId) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {needsCartId && (
              <RuntimeField
                label="cart-id"
                value={cartId}
                onChange={setCartId}
                placeholder="cart-…"
                required
              />
            )}
            {needsSaleId && (
              <RuntimeField
                label="sale-id"
                value={saleId}
                onChange={setSaleId}
                placeholder="sl-…"
                required
              />
            )}
            {needsRuleId && (
              <RuntimeField
                label="rule-id"
                value={ruleId}
                onChange={setRuleId}
                placeholder={RULE_ID_EXAMPLE}
                hint="24-character hex (MongoDB ObjectId)"
                required
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={loadDraft}
          disabled={loadingDraft}
          className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        >
          {loadingDraft ? 'Reloading…' : 'Reset from template'}
        </button>
      </div>

      {draftNote && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2">
          {draftNote}
        </p>
      )}

      <SectionCard
        step={1}
        title="URL"
        hint="Read-only — updates as you enter rule-id, cart-id, or sale-id above."
      >
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-gray-800 text-white">
            {method}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 font-mono text-xs text-gray-700 break-all select-all">
          {resolvedUrl || url || '—'}
        </div>
      </SectionCard>

      <SectionCard step={2} title="Headers" hint="JSON object — header vital fields below sync here too.">
        <textarea
          value={headersText}
          onChange={(e) => handleHeadersChange(e.target.value)}
          className={`w-full min-h-40 font-mono text-xs border rounded-lg p-3 ${
            headersValid ? 'border-gray-300' : 'border-red-400 bg-red-50'
          }`}
          spellCheck={false}
        />
        {!headersValid && (
          <p className="text-xs text-red-600 mt-1">{headersParse.error}</p>
        )}
        {headerVitalFields.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Header vital fields</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {headerVitalFields.map((field) => (
                <VitalFieldInput
                  key={field.id}
                  field={field}
                  value={vitalValues[field.id] ?? ''}
                  onChange={handleVitalChange}
                />
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        step={3}
        title="Request body & vital fields"
        hint={
          hasBody
            ? 'Edit JSON or use inputs — changes stay in sync. Invalid JSON pauses sync until fixed.'
            : 'Not used for GET requests.'
        }
      >
        {hasBody ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="min-h-[280px] flex flex-col">
              <p className="text-xs font-semibold text-gray-700 mb-2">Request body (JSON)</p>
              <textarea
                value={bodyText}
                onChange={(e) => handleBodyChange(e.target.value)}
                className={`flex-1 w-full min-h-[280px] font-mono text-xs border rounded-lg p-3 ${
                  bodyValid ? 'border-gray-300' : 'border-red-400 bg-red-50'
                }`}
                spellCheck={false}
              />
              {!bodyValid && <p className="text-xs text-red-600 mt-1">{bodyParse.error}</p>}
            </div>

            <div className="min-h-[280px] flex flex-col">
              <p className="text-xs font-semibold text-gray-700 mb-2">Vital fields (body)</p>
              {bodyVitalFields.length === 0 ? (
                <p className="text-sm text-gray-500 flex-1">
                  No body vital fields for this action yet.
                </p>
              ) : (
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[320px] pr-1">
                  {bodyVitalFields.map((field) => (
                    <VitalFieldInput
                      key={field.id}
                      field={field}
                      value={vitalValues[field.id] ?? ''}
                      onChange={handleVitalChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No body for this method.</p>
        )}
      </SectionCard>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExecute}
          disabled={executing || !headersValid || (hasBody && !bodyValid) || !url}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm"
        >
          {executing ? 'Running…' : 'Run action'}
        </button>
      </div>

      {lastResponse && (
        <div className="space-y-3">
          {lastResponse.hint && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              {lastResponse.hint}
            </p>
          )}
          <JsonViewerCard
            title={`Response — ${selectedAction?.title || selectedActionId}`}
            status={responseStatus}
            payload={lastResponse}
          />
        </div>
      )}
    </div>
  );
}

function SectionCard({ step, title, hint, children }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {step}
        </span>
        <div>
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function VitalFieldInput({ field, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {field.label}
        <span className="ml-1 text-gray-400 font-normal">
          {field.target === 'header' ? 'header' : `body.${field.path?.join('.')}`}
        </span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field.id, e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full"
      />
    </div>
  );
}

function RuntimeField({ label, value, onChange, placeholder, hint, required = false }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
        spellCheck={false}
      />
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}
