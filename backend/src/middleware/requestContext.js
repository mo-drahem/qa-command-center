const crypto = require('crypto');

function requestContext(req, res, next) {
  const inboundRequestId = String(req.headers['x-request-id'] || '').trim();
  const requestId = inboundRequestId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

module.exports = {
  requestContext,
};
