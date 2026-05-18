const { env } = require('./env');

const fastTrackIdentityDefaults = {
  appId: env.FAST_TRACK_DEFAULT_APP_ID || '51',
  clientId: env.FAST_TRACK_DEFAULT_CLIENT_ID || 'nibz',
  currency: env.FAST_TRACK_DEFAULT_CURRENCY || 'SAR',
  entityId: env.FAST_TRACK_DEFAULT_ENTITY_ID || 'ALM',
  userEmail: env.FAST_TRACK_DEFAULT_USER_EMAIL || 'qa.user@example.com',
  userId: env.FAST_TRACK_DEFAULT_USER_ID || 'qa-user-id',
  userPhone: env.FAST_TRACK_DEFAULT_USER_PHONE || '+962795526409',
};

module.exports = {
  fastTrackIdentityDefaults,
};
