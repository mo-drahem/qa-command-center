require('dotenv').config();

const env = {
  PORT: process.env.PORT || 4000,
  LOGGING_API_DEV_BASE_URL: process.env.LOGGING_API_DEV_BASE_URL || '',
  LOGGING_API_STAGING_BASE_URL: process.env.LOGGING_API_STAGING_BASE_URL || '',
  LOGGING_API_DEFAULT_ENV: process.env.LOGGING_API_DEFAULT_ENV || 'dev',
  COPILOT_MODEL: process.env.COPILOT_MODEL || '',
  COPILOT_API_KEY: process.env.COPILOT_API_KEY || '',
};

/**
 * Resolve the logging base URL for the given environment name.
 * Falls back to the default env when the requested environment is unknown.
 */
function getLoggingBaseUrl(environment) {
  const envKey = (environment || env.LOGGING_API_DEFAULT_ENV).toLowerCase();
  if (envKey === 'staging') {
    return env.LOGGING_API_STAGING_BASE_URL || env.LOGGING_API_DEV_BASE_URL;
  }
  return env.LOGGING_API_DEV_BASE_URL;
}

module.exports = { env, getLoggingBaseUrl };
