export function getActualResponseBody(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'object') return payload;
  if (payload.body !== undefined) return payload.body;
  if (payload.data !== undefined) return payload.data;
  if (payload.response !== undefined) return payload.response;
  return payload;
}

export function parseJsonMaybe(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
