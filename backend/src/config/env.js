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
  FAST_TRACK_DEFAULT_APP_ID: process.env.FAST_TRACK_DEFAULT_APP_ID || '51',
  FAST_TRACK_DEFAULT_ENTITY_ID: process.env.FAST_TRACK_DEFAULT_ENTITY_ID || 'ALM',
  FAST_TRACK_DEFAULT_CLIENT_ID: process.env.FAST_TRACK_DEFAULT_CLIENT_ID || 'nibz',
  FAST_TRACK_DEFAULT_CURRENCY: process.env.FAST_TRACK_DEFAULT_CURRENCY || 'SAR',
  FAST_TRACK_DEFAULT_USER_EMAIL: process.env.FAST_TRACK_DEFAULT_USER_EMAIL || 'qa.user@example.com',
  FAST_TRACK_DEFAULT_USER_ID: process.env.FAST_TRACK_DEFAULT_USER_ID || 'qa-user-id',
  FAST_TRACK_DEFAULT_USER_PHONE: process.env.FAST_TRACK_DEFAULT_USER_PHONE || '+10000000000',
  QA_CENTER_API_KEY: process.env.QA_CENTER_API_KEY || '',
  OMS_SALE_SERVICE_BASE: process.env.OMS_SALE_SERVICE_BASE || '',
  OMS_ORDER_SERVICE_BASE: process.env.OMS_ORDER_SERVICE_BASE || '',
  OMS_CART_SERVICE_BASE: process.env.OMS_CART_SERVICE_BASE || '',
  OMS_CHECKOUT_SERVICE_BASE: process.env.OMS_CHECKOUT_SERVICE_BASE || '',
  OMS_PRICING_CORE_SERVICE_BASE: process.env.OMS_PRICING_CORE_SERVICE_BASE || '',
  OMS_PRICING_MDR_SERVICE_BASE: process.env.OMS_PRICING_MDR_SERVICE_BASE || '',
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
