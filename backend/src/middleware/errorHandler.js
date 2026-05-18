const { HttpError } = require('../lib/httpError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err instanceof HttpError
    ? err.statusCode
    : Number(err.statusCode || err.status || 500);

  const payload = {
    error: err.message || 'Internal server error',
    requestId: req.requestId || null,
  };

  const details = err instanceof HttpError ? err.details : err.details;
  if (details !== undefined && details !== null) {
    payload.details = details;
  }

  console.error('[ERROR]', {
    requestId: req.requestId || null,
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
  });

  res.status(status).json(payload);
}

module.exports = {
  errorHandler,
};
