const STORAGE_KEY = 'qa-command-center.saved-reports';
const MAX_REPORTS = 50;

export function listSavedReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReport(entry) {
  const reports = listSavedReports();
  const next = [
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...reports,
  ].slice(0, MAX_REPORTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteSavedReport(id) {
  const next = listSavedReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
