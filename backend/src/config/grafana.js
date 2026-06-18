const { env } = require('./env');
const { getGrafanaSettings } = require('../services/grafanaLokiApi');

function isGrafanaConfigured(environment) {
  return Boolean(getGrafanaSettings(environment).baseUrl);
}

function getGrafanaMissingFields(environment) {
  const raw = String(environment || 'dev').toLowerCase();
  const envKey = raw === 'prod' ? 'production' : raw;
  const missing = [];
  const baseUrlKey =
    envKey === 'staging'
      ? 'GRAFANA_STAGING_BASE_URL'
      : envKey === 'production'
        ? 'GRAFANA_PRODUCTION_BASE_URL'
        : 'GRAFANA_DEV_BASE_URL';
  const settings = getGrafanaSettings(environment);

  if (!settings.baseUrl) {
    missing.push(baseUrlKey);
    if (envKey === 'dev') {
      missing.push('LOKI_BASE_URL');
    }
  }
  if (!settings.apiToken) {
    missing.push('GRAFANA_API_TOKEN');
  }
  return missing;
}

function getGrafanaPublicConfig(environment) {
  const settings = getGrafanaSettings(environment);
  const missing = getGrafanaMissingFields(environment);
  return {
    configured: Boolean(settings.baseUrl),
    hasToken: Boolean(settings.apiToken),
    ready: Boolean(settings.baseUrl && settings.apiToken),
    missingEnvKeys: missing,
    lookbackHours: settings.lookbackHours,
    tracerLogqlTemplate: settings.tracerLogqlTemplate,
  };
}

module.exports = {
  isGrafanaConfigured,
  getGrafanaPublicConfig,
};
