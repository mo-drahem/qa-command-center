const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  yamlToFlatConfig,
  buildConfig,
  readYamlFile,
} = require('../src/config/loadConfig');

test('yamlToFlatConfig maps nested YAML to flat env keys', () => {
  const flat = yamlToFlatConfig({
    server: { port: 8080, serveFrontend: true },
    secrets: { qaCenterApiKey: 'secret-key', geminiApiKey: 'gem-key' },
    logging: {
      devBaseUrl: 'http://dev-logging',
      stagingBaseUrl: 'http://staging-logging',
      productionBaseUrl: 'http://prod-logging',
      defaultEnv: 'staging',
    },
    grafana: {
      productionBaseUrl: 'https://grafana-prod.example',
      productionDatasourceUid: 'loki-prod-uid',
    },
    ai: { geminiModel: 'gemini-test', geminiTimeoutMs: 120000 },
    fastTrack: {
      defaults: { appId: '99', userEmail: 'qa@test.com' },
    },
    oms: { cartServiceBase: 'http://custom-cart' },
  });

  assert.equal(flat.PORT, 8080);
  assert.equal(flat.SERVE_FRONTEND, true);
  assert.equal(flat.QA_CENTER_API_KEY, 'secret-key');
  assert.equal(flat.GEMINI_API_KEY, 'gem-key');
  assert.equal(flat.LOGGING_API_DEV_BASE_URL, 'http://dev-logging');
  assert.equal(flat.LOGGING_API_STAGING_BASE_URL, 'http://staging-logging');
  assert.equal(flat.LOGGING_API_PRODUCTION_BASE_URL, 'http://prod-logging');
  assert.equal(flat.LOGGING_API_DEFAULT_ENV, 'staging');
  assert.equal(flat.GRAFANA_PRODUCTION_BASE_URL, 'https://grafana-prod.example');
  assert.equal(flat.GRAFANA_PRODUCTION_DATASOURCE_UID, 'loki-prod-uid');
  assert.equal(flat.GEMINI_MODEL, 'gemini-test');
  assert.equal(flat.GEMINI_TIMEOUT_MS, 120000);
  assert.equal(flat.FAST_TRACK_DEFAULT_APP_ID, '99');
  assert.equal(flat.FAST_TRACK_DEFAULT_USER_EMAIL, 'qa@test.com');
  assert.equal(flat.OMS_CART_SERVICE_BASE, 'http://custom-cart');
});

test('buildConfig loads values from a YAML file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-config-'));
  const configPath = path.join(tempDir, 'config.yaml');
  fs.writeFileSync(configPath, `
server:
  port: 5001
secrets:
  qaCenterApiKey: yaml-api-key
logging:
  devBaseUrl: http://logging-dev.internal
`);

  const previous = process.env.QA_CENTER_API_KEY;
  delete process.env.QA_CENTER_API_KEY;
  delete process.env.PORT;

  try {
    const { config, configPath: loadedPath, source } = buildConfig({ configPath });
    assert.equal(loadedPath, configPath);
    assert.equal(source, 'yaml');
    assert.equal(config.PORT, 5001);
    assert.equal(config.QA_CENTER_API_KEY, 'yaml-api-key');
    assert.equal(config.LOGGING_API_DEV_BASE_URL, 'http://logging-dev.internal');
  } finally {
    if (previous !== undefined) {
      process.env.QA_CENTER_API_KEY = previous;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('environment variables override YAML values', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-config-'));
  const configPath = path.join(tempDir, 'config.yaml');
  fs.writeFileSync(configPath, 'server:\n  port: 5001\n');

  const previousPort = process.env.PORT;
  process.env.PORT = '6000';

  try {
    const { config } = buildConfig({ configPath });
    assert.equal(config.PORT, 6000);
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readYamlFile returns empty object for missing file', () => {
  assert.deepEqual(readYamlFile('/path/that/does/not/exist.yaml'), {});
});
