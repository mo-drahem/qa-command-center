import { useState } from 'react';
import toast from 'react-hot-toast';
import { generateNarrative } from '../api/loggerApi';

function StoryCard({ story }) {
  if (!story) return null;

  // Convert simple markdown-ish text to rendered lines for readability
  const lines = story.split('\n');

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">📖 QA Narrative</h2>
      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {lines.map((line, i) => {
          if (line.startsWith('## ') || line.startsWith('### ')) {
            return (
              <p key={i} className="font-bold text-gray-800 mt-4 mb-1">
                {line.replace(/^#{2,3} /, '')}
              </p>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <p key={i} className="ml-4 text-gray-700">
                • {line.slice(2)}
              </p>
            );
          }
          if (line.trim() === '') {
            return <br key={i} />;
          }
          return (
            <p key={i} className="text-gray-700">
              {line}
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
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 uppercase text-xs">
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Method</th>
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
                  className={`border-b border-gray-100 ${isError ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 pr-4 font-medium text-gray-800">
                    {log.serviceName || '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                      {log.method || 'GET'}
                    </span>
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

export default function LoggerView() {
  const [tracerId, setTracerId] = useState('');
  const [environment, setEnvironment] = useState('dev');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!tracerId.trim()) {
      toast.error('Please enter a Tracer ID.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await generateNarrative(tracerId.trim(), environment);
      setResult(data);
      toast.success('Narrative generated!');
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Failed to generate narrative. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">🛠 QA Command Center</h1>
          <p className="mt-2 text-gray-500">Generate a chronological User Story from tracer logs.</p>
        </div>

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
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {result.environment}
              </span>
              <span className="text-gray-500 text-sm font-mono">Tracer: {result.tracerId}</span>
            </div>
            <StoryCard story={result.story} />
            <CallsTable logs={result.logs} />
          </div>
        )}
      </div>
    </div>
  );
}
