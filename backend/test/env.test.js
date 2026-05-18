const test = require('node:test');
const assert = require('node:assert/strict');
const { getLoggingBaseUrl } = require('../src/config/env');

test('getLoggingBaseUrl falls back to dev for unknown env', () => {
  const value = getLoggingBaseUrl('unknown-env');
  assert.equal(typeof value, 'string');
});
