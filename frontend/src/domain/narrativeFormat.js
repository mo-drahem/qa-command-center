export function formatTokenCount(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString();
}
