const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 4000,
  LOGGING_API_DEV_BASE_URL: process.env.LOGGING_API_DEV_BASE_URL || '',
  LOGGING_API_STAGING_BASE_URL: process.env.LOGGING_API_STAGING_BASE_URL || '',
  LOGGING_API_DEFAULT_ENV: process.env.LOGGING_API_DEFAULT_ENV || 'dev',
  COPILOT_MODEL: process.env.COPILOT_MODEL || '',
  COPILOT_API_KEY: process.env.COPILOT_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_TIMEOUT_MS: Number(process.env.GEMINI_TIMEOUT_MS || 90000),
};

function sanitizeBaseUrl(raw) {
  return String(raw || '').trim().replace(/^['"]|['"]$/g, '');
}

function isPlaceholderHost(urlValue) {
  return /example\.com/i.test(urlValue);
}

function assertValidLoggingBaseUrl(urlValue, envName) {
  if (!urlValue) return;
  if (isPlaceholderHost(urlValue)) {
    throw new Error(
      `[env] Invalid ${envName} logging URL: placeholder domain detected (${urlValue}). ` +
      `Set LOGGING_API_${envName.toUpperCase()}_BASE_URL to a real host in backend/.env.`
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  assertValidLoggingBaseUrl(sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL), 'dev');
  assertValidLoggingBaseUrl(sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL), 'staging');
  console.log('[env] logging hosts loaded', {
    dev: sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL) || '(empty)',
    staging: sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL) || '(empty)',
    defaultEnv: env.LOGGING_API_DEFAULT_ENV,
  });
};

/**
 * Resolve the logging base URL for the given environment name.
 * Falls back to the default env when the requested environment is unknown.
 */
function getLoggingBaseUrl(environment) {
  const envKey = (environment || env.LOGGING_API_DEFAULT_ENV).toLowerCase();
  if (envKey === 'staging') {
    return sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL) || sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL);
  }
  return sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL);
}

module.exports = { env, getLoggingBaseUrl };
