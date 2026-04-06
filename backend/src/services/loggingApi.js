const axios = require('axios');
const { getLoggingBaseUrl } = require('../config/env');

/**
 * Fetch logs from the external logging service.
 *
 * Expected response shape from the logging service:
 * {
 *   logs: [
 *     {
 *       serviceName: string,
 *       requestURI: string,
 *       timestamp: string,   // ISO-8601 recommended
 *       statusCode: number,  // HTTP status code of the captured call
 *       method: string,      // HTTP method (optional)
 *       durationMs: number   // latency in ms (optional)
 *     },
 *     ...
 *   ]
 * }
 */
async function fetchLogs(tracerId, environment) {
  const baseUrl = getLoggingBaseUrl(environment);

  if (!baseUrl) {
    throw new Error(
      'Logging service base URL is not configured. ' +
      'Set LOGGING_API_DEV_BASE_URL or LOGGING_API_STAGING_BASE_URL in your .env file.'
    );
  }

  const url = `${baseUrl}/logs/list`;
  const response = await axios.get(url, {
    params: { tracerId },
    timeout: 10000,
  });

  // Normalise: the service may wrap logs in a `data` key or return an array directly.
  const body = response.data;
  if (Array.isArray(body)) {
    return body;
  }
  if (body && Array.isArray(body.logs)) {
    return body.logs;
  }
  if (body && Array.isArray(body.data)) {
    return body.data;
  }
  return [];
}

module.exports = { fetchLogs };
