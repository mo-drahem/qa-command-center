import { useState } from 'react';

export function JsonNode({ name, value, depth = 0, defaultExpandDepth = 1, resetKey = 0 }) {
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

export function JsonViewerCard({ title, status, payload }) {
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

