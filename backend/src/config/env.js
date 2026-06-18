const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { buildConfig } = require('./loadConfig');

const { config: env, configPath, source } = buildConfig();

function sanitizeBaseUrl(raw) {
  return String(raw || '').trim().replace(/^['"]|['"]$/g, '');
}

function isPlaceholderHost(urlValue) {
  return /example\.com/i.test(urlValue);
}

const LOGGING_YAML_KEYS = {
  dev: 'devBaseUrl',
  staging: 'stagingBaseUrl',
  production: 'productionBaseUrl',
};

function assertValidLoggingBaseUrl(urlValue, envName) {
  if (!urlValue) return;
  if (isPlaceholderHost(urlValue)) {
    const yamlKey = LOGGING_YAML_KEYS[envName] || `${envName}BaseUrl`;
    throw new Error(
      `[config] Invalid ${envName} logging URL: placeholder domain detected (${urlValue}). ` +
      `Set logging.${yamlKey} in config.yaml ` +
      `or LOGGING_API_${String(envName).toUpperCase()}_BASE_URL in the environment.`
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  assertValidLoggingBaseUrl(sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL), 'dev');
  assertValidLoggingBaseUrl(sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL), 'staging');
  assertValidLoggingBaseUrl(sanitizeBaseUrl(env.LOGGING_API_PRODUCTION_BASE_URL), 'production');
  const grafanaDev = sanitizeBaseUrl(env.GRAFANA_DEV_BASE_URL) || sanitizeBaseUrl(env.LOKI_BASE_URL) || '';
  const grafanaStaging = sanitizeBaseUrl(env.GRAFANA_STAGING_BASE_URL) || '';
  const grafanaProduction = sanitizeBaseUrl(env.GRAFANA_PRODUCTION_BASE_URL) || '';
  console.log('[config] loaded', {
    source,
    path: configPath || '(none – using .env / defaults)',
    dev: sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL) || '(empty)',
    staging: sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL) || '(empty)',
    production: sanitizeBaseUrl(env.LOGGING_API_PRODUCTION_BASE_URL) || '(empty)',
    grafanaDev: grafanaDev || '(empty – set GRAFANA_DEV_BASE_URL or LOKI_BASE_URL)',
    grafanaStaging: grafanaStaging || '(empty)',
    grafanaProduction: grafanaProduction || '(empty)',
    grafanaToken: env.GRAFANA_API_TOKEN || env.LOKI_API_TOKEN ? '(set)' : '(empty)',
    defaultEnv: env.LOGGING_API_DEFAULT_ENV,
    serveFrontend: env.SERVE_FRONTEND,
  });
}

/**
 * Resolve the logging base URL for the given environment name.
 * Falls back to the default env when the requested environment is unknown.
 */
function getLoggingBaseUrl(environment) {
  const raw = String(environment || env.LOGGING_API_DEFAULT_ENV || 'dev').toLowerCase();
  const envKey = raw === 'prod' ? 'production' : raw;
  if (envKey === 'staging') {
    return sanitizeBaseUrl(env.LOGGING_API_STAGING_BASE_URL) || sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL);
  }
  if (envKey === 'production') {
    return sanitizeBaseUrl(env.LOGGING_API_PRODUCTION_BASE_URL) || '';
  }
  return sanitizeBaseUrl(env.LOGGING_API_DEV_BASE_URL);
}

module.exports = { env, getLoggingBaseUrl, configPath, configSource: source };
