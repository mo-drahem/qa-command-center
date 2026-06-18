const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ENV_KEYS = {
  PORT: 'PORT',
  LOGGING_API_DEV_BASE_URL: 'LOGGING_API_DEV_BASE_URL',
  LOGGING_API_STAGING_BASE_URL: 'LOGGING_API_STAGING_BASE_URL',
  LOGGING_API_PRODUCTION_BASE_URL: 'LOGGING_API_PRODUCTION_BASE_URL',
  LOGGING_API_DEFAULT_ENV: 'LOGGING_API_DEFAULT_ENV',
  COPILOT_MODEL: 'COPILOT_MODEL',
  COPILOT_API_KEY: 'COPILOT_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_TIMEOUT_MS: 'GEMINI_TIMEOUT_MS',
  FAST_TRACK_DEFAULT_APP_ID: 'FAST_TRACK_DEFAULT_APP_ID',
  FAST_TRACK_DEFAULT_ENTITY_ID: 'FAST_TRACK_DEFAULT_ENTITY_ID',
  FAST_TRACK_DEFAULT_CLIENT_ID: 'FAST_TRACK_DEFAULT_CLIENT_ID',
  FAST_TRACK_DEFAULT_CURRENCY: 'FAST_TRACK_DEFAULT_CURRENCY',
  FAST_TRACK_DEFAULT_USER_EMAIL: 'FAST_TRACK_DEFAULT_USER_EMAIL',
  FAST_TRACK_DEFAULT_USER_ID: 'FAST_TRACK_DEFAULT_USER_ID',
  FAST_TRACK_DEFAULT_USER_PHONE: 'FAST_TRACK_DEFAULT_USER_PHONE',
  QA_CENTER_API_KEY: 'QA_CENTER_API_KEY',
  OMS_SALE_SERVICE_BASE: 'OMS_SALE_SERVICE_BASE',
  OMS_ORDER_SERVICE_BASE: 'OMS_ORDER_SERVICE_BASE',
  OMS_CART_SERVICE_BASE: 'OMS_CART_SERVICE_BASE',
  OMS_CHECKOUT_SERVICE_BASE: 'OMS_CHECKOUT_SERVICE_BASE',
  OMS_PRICING_CORE_SERVICE_BASE: 'OMS_PRICING_CORE_SERVICE_BASE',
  OMS_PRICING_MDR_SERVICE_BASE: 'OMS_PRICING_MDR_SERVICE_BASE',
  SERVE_FRONTEND: 'SERVE_FRONTEND',
  GRAFANA_DEV_BASE_URL: 'GRAFANA_DEV_BASE_URL',
  GRAFANA_STAGING_BASE_URL: 'GRAFANA_STAGING_BASE_URL',
  GRAFANA_PRODUCTION_BASE_URL: 'GRAFANA_PRODUCTION_BASE_URL',
  GRAFANA_DEV_DATASOURCE_UID: 'GRAFANA_DEV_DATASOURCE_UID',
  GRAFANA_STAGING_DATASOURCE_UID: 'GRAFANA_STAGING_DATASOURCE_UID',
  GRAFANA_PRODUCTION_DATASOURCE_UID: 'GRAFANA_PRODUCTION_DATASOURCE_UID',
  GRAFANA_API_TOKEN: 'GRAFANA_API_TOKEN',
  LOKI_BASE_URL: 'LOKI_BASE_URL',
  LOKI_API_TOKEN: 'LOKI_API_TOKEN',
  GRAFANA_TRACER_LOGQL_TEMPLATE: 'GRAFANA_TRACER_LOGQL_TEMPLATE',
  GRAFANA_LOOKBACK_HOURS: 'GRAFANA_LOOKBACK_HOURS',
};

const DEFAULTS = {
  PORT: 4000,
  LOGGING_API_DEV_BASE_URL: '',
  LOGGING_API_STAGING_BASE_URL: '',
  LOGGING_API_PRODUCTION_BASE_URL: '',
  LOGGING_API_DEFAULT_ENV: 'dev',
  COPILOT_MODEL: '',
  COPILOT_API_KEY: '',
  GEMINI_MODEL: 'gemini-3.1-flash-lite',
  GEMINI_API_KEY: '',
  GEMINI_TIMEOUT_MS: 90000,
  FAST_TRACK_DEFAULT_APP_ID: '51',
  FAST_TRACK_DEFAULT_ENTITY_ID: 'ALM',
  FAST_TRACK_DEFAULT_CLIENT_ID: 'nibz',
  FAST_TRACK_DEFAULT_CURRENCY: 'SAR',
  FAST_TRACK_DEFAULT_USER_EMAIL: 'qa.user@example.com',
  FAST_TRACK_DEFAULT_USER_ID: 'qa-user-id',
  FAST_TRACK_DEFAULT_USER_PHONE: '+10000000000',
  QA_CENTER_API_KEY: '',
  OMS_SALE_SERVICE_BASE: '',
  OMS_ORDER_SERVICE_BASE: '',
  OMS_CART_SERVICE_BASE: '',
  OMS_CHECKOUT_SERVICE_BASE: '',
  OMS_PRICING_CORE_SERVICE_BASE: '',
  OMS_PRICING_MDR_SERVICE_BASE: '',
  SERVE_FRONTEND: false,
  GRAFANA_DEV_BASE_URL: '',
  GRAFANA_STAGING_BASE_URL: '',
  GRAFANA_PRODUCTION_BASE_URL: '',
  GRAFANA_DEV_DATASOURCE_UID: '',
  GRAFANA_STAGING_DATASOURCE_UID: '',
  GRAFANA_PRODUCTION_DATASOURCE_UID: '',
  GRAFANA_API_TOKEN: '',
  LOKI_BASE_URL: '',
  LOKI_API_TOKEN: '',
  GRAFANA_TRACER_LOGQL_TEMPLATE: '{job=~"oms.*"} |~ "(?i){{tracerId}}"',
  GRAFANA_LOOKBACK_HOURS: 24,
};

function resolveConfigPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }
  if (process.env.QA_CENTER_CONFIG_PATH) {
    return path.resolve(process.env.QA_CENTER_CONFIG_PATH);
  }

  const candidates = [
    path.resolve(process.cwd(), 'config/config.yaml'),
    path.resolve(process.cwd(), '../config/config.yaml'),
    path.resolve(__dirname, '../../../config/config.yaml'),
    path.resolve(__dirname, '../../config/config.yaml'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readYamlFile(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function yamlToFlatConfig(yamlConfig) {
  const yaml = yamlConfig || {};

  return {
    PORT: yaml.server?.port,
    SERVE_FRONTEND: yaml.server?.serveFrontend,
    QA_CENTER_API_KEY: yaml.secrets?.qaCenterApiKey,
    GEMINI_API_KEY: yaml.secrets?.geminiApiKey,
    COPILOT_API_KEY: yaml.secrets?.copilotApiKey,
    LOGGING_API_DEV_BASE_URL: yaml.logging?.devBaseUrl,
    LOGGING_API_STAGING_BASE_URL: yaml.logging?.stagingBaseUrl,
    LOGGING_API_PRODUCTION_BASE_URL: yaml.logging?.productionBaseUrl,
    LOGGING_API_DEFAULT_ENV: yaml.logging?.defaultEnv,
    GEMINI_MODEL: yaml.ai?.geminiModel,
    GEMINI_TIMEOUT_MS: yaml.ai?.geminiTimeoutMs,
    COPILOT_MODEL: yaml.ai?.copilotModel,
    FAST_TRACK_DEFAULT_APP_ID: yaml.fastTrack?.defaults?.appId,
    FAST_TRACK_DEFAULT_ENTITY_ID: yaml.fastTrack?.defaults?.entityId,
    FAST_TRACK_DEFAULT_CLIENT_ID: yaml.fastTrack?.defaults?.clientId,
    FAST_TRACK_DEFAULT_CURRENCY: yaml.fastTrack?.defaults?.currency,
    FAST_TRACK_DEFAULT_USER_EMAIL: yaml.fastTrack?.defaults?.userEmail,
    FAST_TRACK_DEFAULT_USER_ID: yaml.fastTrack?.defaults?.userId,
    FAST_TRACK_DEFAULT_USER_PHONE: yaml.fastTrack?.defaults?.userPhone,
    OMS_SALE_SERVICE_BASE: yaml.oms?.saleServiceBase,
    OMS_ORDER_SERVICE_BASE: yaml.oms?.orderServiceBase,
    OMS_CART_SERVICE_BASE: yaml.oms?.cartServiceBase,
    OMS_CHECKOUT_SERVICE_BASE: yaml.oms?.checkoutServiceBase,
    OMS_PRICING_CORE_SERVICE_BASE: yaml.oms?.pricingCoreServiceBase,
    OMS_PRICING_MDR_SERVICE_BASE: yaml.oms?.pricingMdrServiceBase,
    GRAFANA_DEV_BASE_URL: yaml.grafana?.devBaseUrl,
    GRAFANA_STAGING_BASE_URL: yaml.grafana?.stagingBaseUrl,
    GRAFANA_PRODUCTION_BASE_URL: yaml.grafana?.productionBaseUrl,
    GRAFANA_DEV_DATASOURCE_UID: yaml.grafana?.devDatasourceUid,
    GRAFANA_STAGING_DATASOURCE_UID: yaml.grafana?.stagingDatasourceUid,
    GRAFANA_PRODUCTION_DATASOURCE_UID: yaml.grafana?.productionDatasourceUid,
    GRAFANA_API_TOKEN: yaml.secrets?.grafanaApiToken || yaml.grafana?.apiToken,
    LOKI_BASE_URL: yaml.grafana?.lokiBaseUrl,
    LOKI_API_TOKEN: yaml.secrets?.lokiApiToken || yaml.grafana?.lokiApiToken,
    GRAFANA_TRACER_LOGQL_TEMPLATE: yaml.grafana?.tracerLogqlTemplate,
    GRAFANA_LOOKBACK_HOURS: yaml.grafana?.lookbackHours,
  };
}

function pickValue(envKey, yamlValue, defaultValue) {
  if (process.env[envKey] !== undefined) {
    return process.env[envKey];
  }
  if (yamlValue !== undefined && yamlValue !== null) {
    return yamlValue;
  }
  return defaultValue;
}

function parseBoolean(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function buildConfig(options = {}) {
  const configPath = resolveConfigPath(options.configPath);
  const yamlConfig = readYamlFile(configPath);
  const yamlFlat = yamlToFlatConfig(yamlConfig);

  const config = {};
  for (const [key, envKey] of Object.entries(ENV_KEYS)) {
    config[key] = pickValue(envKey, yamlFlat[key], DEFAULTS[key]);
  }

  config.PORT = Number(config.PORT) || DEFAULTS.PORT;
  config.GEMINI_TIMEOUT_MS = Number(config.GEMINI_TIMEOUT_MS) || DEFAULTS.GEMINI_TIMEOUT_MS;
  config.GRAFANA_LOOKBACK_HOURS = Number(config.GRAFANA_LOOKBACK_HOURS) || DEFAULTS.GRAFANA_LOOKBACK_HOURS;
  config.SERVE_FRONTEND = parseBoolean(
    config.SERVE_FRONTEND,
    process.env.NODE_ENV === 'production'
  );

  return {
    config,
    configPath,
    source: configPath ? 'yaml' : (Object.keys(process.env).some((k) => ENV_KEYS[k]) ? 'env' : 'defaults'),
  };
}

module.exports = {
  ENV_KEYS,
  DEFAULTS,
  resolveConfigPath,
  readYamlFile,
  yamlToFlatConfig,
  buildConfig,
};
