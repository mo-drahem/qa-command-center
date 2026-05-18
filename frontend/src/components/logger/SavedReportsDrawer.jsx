import { useState } from 'react';
import { deleteSavedReport, listSavedReports } from '../../domain/savedReports';

export default function SavedReportsDrawer({ open, onClose, onLoadReport }) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (!open) return null;

  const reports = listSavedReports();
  void refreshKey;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Saved reports</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-500">No saved tracer reports yet. Save from the Narrative tab.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                <p className="font-mono font-semibold text-gray-800">{r.tracerId}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {r.environment} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.note && <p className="text-xs text-gray-600 mt-1">{r.note}</p>}
                <p className="text-xs text-gray-500 mt-1">Mismatches: {r.mismatchCount ?? '—'}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => onLoadReport(r)}
                    className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white"
                  >
                    Re-run
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteSavedReport(r.id);
                      setRefreshKey((k) => k + 1);
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
