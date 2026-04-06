import client from './client';

/**
 * Generate a QA narrative from tracer logs.
 *
 * @param {string} tracerId - The tracer ID to look up.
 * @param {'dev'|'staging'} environment - Target environment.
 * @returns {Promise<{ tracerId: string, environment: string, story: string, logs: object[] }>}
 */
export async function generateNarrative(tracerId, environment) {
  const response = await client.post('/logger/narrative', { tracerId, environment });
  return response.data;
}
