const STORAGE_KEY = 'qaCenterApiKey';

export async function ensureRuntimeAuth() {
  const response = await fetch('/api/runtime-config');
  if (!response.ok) return;

  const { requiresApiKey } = await response.json();
  if (!requiresApiKey) return;

  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const entered = window.prompt('Enter QA Command Center API key');
  if (!entered?.trim()) {
    throw new Error('API key is required to use QA Command Center.');
  }

  sessionStorage.setItem(STORAGE_KEY, entered.trim());
}

export function getStoredApiKey() {
  return sessionStorage.getItem(STORAGE_KEY) || '';
}
