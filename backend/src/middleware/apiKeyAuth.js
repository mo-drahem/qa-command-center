const { env } = require('../config/env');
const { badRequest } = require('../lib/httpError');

function apiKeyAuth(req, res, next) {
  const configured = String(env.QA_CENTER_API_KEY || '').trim();
  if (!configured) return next();

  const header = String(req.headers['x-api-key'] || req.headers.authorization || '').trim();
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header;
  if (token !== configured) {
    return next(badRequest('Invalid or missing API key.'));
  }
  return next();
}

module.exports = { apiKeyAuth };
