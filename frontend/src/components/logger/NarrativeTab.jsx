import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { generateNarrative } from '../../api/loggerApi';
import { saveReport } from '../../domain/savedReports';
import { getActualResponseBody } from '../../domain/json';
import { JsonViewerCard } from './JsonViewer';
import { formatTokenCount } from '../../domain/narrativeFormat';
import {
  CallsTable,
  CriticalAlert,
  CurlPreview,
  FinancialReconciliationReport,
  MathValidationPanel,
  StatChip,
  StoryCard,
  TimelinePanel,
  VitalDataPanel,
} from './NarrativePanels';

export default function NarrativeTab({ onVitalLookup, initialTracerId, initialEnvironment }) {
  const [inputMode, setInputMode] = useState('tracer');
  const [tracerId, setTracerId] = useState(initialTracerId || '');
  const [environment, setEnvironment] = useState(initialEnvironment || 'dev');
  const [focusPrompt, setFocusPrompt] = useState('');
  const [pastedLogText, setPastedLogText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [narrativeApiPayload, setNarrativeApiPayload] = useState(null);
  const [narrativeApiStatus, setNarrativeApiStatus] = useState('success');
  const [saveNote, setSaveNote] = useState('');

  useEffect(() => {
    if (initialTracerId?.trim()) {
      handleSubmit({ preventDefault: () => {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTracerId, initialEnvironment]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (inputMode === 'paste') {
      if (!pastedLogText.trim()) {
        toast.error('Paste log text copied from Grafana.');
        return;
      }
    } else if (!tracerId.trim()) {
      toast.error('Please enter a Tracer ID.');
      return;
    }
    setLoading(true);
    setResult(null);
    setNarrativeApiPayload(null);
    try {
      const data = await generateNarrative(tracerId.trim(), environment, {
        focusPrompt: focusPrompt.trim() || undefined,
        logText: inputMode === 'paste' ? pastedLogText : undefined,
      });
      setResult(data);
      setNarrativeApiPayload(data);
      setNarrativeApiStatus('success');
      toast.success('Narrative generated!');
    } catch (err) {
      const payload = err.response?.data || { error: err.message || 'Failed to generate narrative.' };
      setNarrativeApiPayload(payload);
      setNarrativeApiStatus('error');
      toast.error(payload?.error || 'Failed to generate narrative.');
    } finally {
      setLoading(false);
    }
  }

  function handleSaveReport() {
    if (!result?.tracerId) {
      toast.error('Generate a narrative first.');
      return;
    }
    saveReport({
      tracerId: result.tracerId,
      environment: result.environment,
      mismatchCount: result.mathValidation?.summary?.mismatchCount ?? 0,
      note: saveNote.trim() || undefined,
    });
    toast.success('Report saved locally.');
  }

  const currency =
    result?.insights?.vitalData?.find((v) => /currency=/i.test(String(v)))?.split('=')[1]?.trim() || 'SAR';

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-4"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInputMode('tracer')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              inputMode === 'tracer'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            Tracer ID
          </button>
          <button
            type="button"
            onClick={() => setInputMode('paste')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              inputMode === 'paste'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            Grafana logs
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col gap-1 sm:w-auto sm:shrink-0">
            <span className="text-sm font-medium text-gray-600" id="narrative-environment-label">
              Environment
            </span>
            <div
              className="flex flex-wrap rounded-lg border border-gray-300 p-0.5 bg-gray-50 gap-0.5"
              role="group"
              aria-labelledby="narrative-environment-label"
            >
              <button
                type="button"
                onClick={() => setEnvironment('dev')}
                className={`flex-1 min-w-[4rem] px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  environment === 'dev'
                    ? 'bg-white shadow-sm text-blue-700 ring-1 ring-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                dev
              </button>
              <button
                type="button"
                onClick={() => setEnvironment('staging')}
                className={`flex-1 min-w-[4rem] px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  environment === 'staging'
                    ? 'bg-white shadow-sm text-blue-700 ring-1 ring-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                staging
              </button>
              <button
                type="button"
                onClick={() => setEnvironment('production')}
                className={`flex-1 min-w-[4rem] px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  environment === 'production'
                    ? 'bg-white shadow-sm text-blue-700 ring-1 ring-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                production
              </button>
            </div>
          </div>
          {inputMode === 'tracer' ? (
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-600" htmlFor="pastedLogText">
                Log text from Grafana
              </label>
              <textarea
                id="pastedLogText"
                value={pastedLogText}
                onChange={(e) => setPastedLogText(e.target.value)}
                placeholder="Paste lines copied from Grafana Explore (plain text, JSON lines, or a JSON array)"
                rows={10}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          )}
        </div>
        {inputMode === 'paste' && (
          <p className="text-xs text-gray-500">
            Copy log lines from Grafana Explore and paste here. No Grafana connection is required — the server
            parses the text and runs the same AI investigation.
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600" htmlFor="focusPrompt">
            Focus instructions for the AI Agent(optional)
          </label>
          <textarea
            id="focusPrompt"
            value={focusPrompt}
            onChange={(e) => setFocusPrompt(e.target.value)}
            placeholder="e.g. Only validate VAT on the flight product, or compare grandTotals between cart and checkout"
            rows={3}
            maxLength={2000}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">
            Steers the AI on top of the default analysis. The pasted logs remain the source of truth.
          </p>
        </div>
        {inputMode === 'tracer' && <CurlPreview tracerId={tracerId} environment={environment} />}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm"
        >
          {loading ? 'Generating…' : 'Generate Story'}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow p-4 border border-gray-100 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {result.environment}
              </span>
              <span className="text-gray-500 text-sm font-mono">Tracer: {result.tracerId}</span>
              {result.logSource === 'grafana-paste' && (
                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                  Pasted logs
                </span>
              )}
            </div>
            {result.conclusion && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold mb-1">Investigation conclusion</p>
                <p>{result.conclusion}</p>
              </div>
            )}
            {result.tokenUsage?.totalTokens > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  Tokens: {formatTokenCount(result.tokenUsage.totalTokens)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatChip label="Calls" value={result.logs?.length ?? 0} />
              <StatChip label="Math Pairs" value={result.mathValidation?.summary?.pairCount ?? 0} />
              <StatChip label="Mismatches" value={result.mathValidation?.summary?.mismatchCount ?? 0} />
              <StatChip label="Compared Logs" value={result.mathValidation?.summary?.logsCompared ?? 0} />
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                type="text"
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
                placeholder="Optional note for saved report"
                className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveReport}
                className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg"
              >
                Save report
              </button>
            </div>
          </div>
          {result.aiReason && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {result.aiReason}
            </p>
          )}
          <CriticalAlert mathValidation={result.mathValidation} currency={currency} />
          <FinancialReconciliationReport logs={result.logs} mathValidation={result.mathValidation} result={result} />
          <TimelinePanel logs={result.logs} />
          <VitalDataPanel vitalData={result.insights?.vitalData} onLookup={onVitalLookup} />
          <MathValidationPanel
            mathValidation={result.mathValidation}
            mathProvider={result.mathProvider}
            mathReason={result.mathReason}
            deterministicValidation={result.deterministicValidation}
          />
          <StoryCard story={result.story} />
          <CallsTable logs={result.logs} />
          <JsonViewerCard
            title="Narrative Response Body (Smart JSON)"
            status={narrativeApiStatus}
            payload={getActualResponseBody(narrativeApiPayload)}
          />
        </div>
      )}
    </div>
  );
}
