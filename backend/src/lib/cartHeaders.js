const { fastTrackIdentityDefaults } = require('../config/fastTrackDefaults');
const { getExampleFixtures } = require('./exampleFixtures');

function sharedCartHeaders(runtime = {}) {
  const defaults = fastTrackIdentityDefaults;
  const appId = String(runtime.appId || defaults.appId).trim();
  return {
    'app-id': appId,
    'x-currency': String(runtime.currency || defaults.currency).trim(),
    'x-user-email': String(runtime.userEmail || defaults.userEmail).trim(),
    'x-user-id': String(runtime.userId || defaults.userId).trim(),
    'Content-Type': 'application/json',
  };
}

function cartProductHeaders(runtime = {}) {
  const { cartProductExtraHeaders } = getExampleFixtures();
  return {
    ...sharedCartHeaders(runtime),
    ...cartProductExtraHeaders,
  };
}

function saleLookupHeaders(runtime = {}) {
  const defaults = fastTrackIdentityDefaults;
  return {
    accept: 'application/json',
    'x-currency': String(runtime.currency || defaults.currency).trim(),
    'x-skip-expiry-check': 'true',
  };
}

const { hasRuntimeCartId } = require('./runtimePlaceholders');

module.exports = {
  sharedCartHeaders,
  cartProductHeaders,
  saleLookupHeaders,
  hasRuntimeCartId,
};
