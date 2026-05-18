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
  const [tracerId, setTracerId] = useState(initialTracerId || '');
  const [environment, setEnvironment] = useState(initialEnvironment || 'dev');
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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col gap-1 sm:w-40">
            <label className="text-sm font-medium text-gray-600" htmlFor="environment">
              Environment
            </label>
            <select
              id="environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
            </select>
          </div>
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
        </div>
        <CurlPreview tracerId={tracerId} environment={environment} />
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
            </div>
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
