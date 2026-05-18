function auditLog(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      user: String(req.headers['x-forwarded-user'] || req.headers['x-user-email'] || '').slice(0, 120) || null,
      environment: req.body?.environment || null,
      tracerIdPrefix: req.body?.tracerId ? String(req.body.tracerId).slice(0, 8) : null,
      lookupType: req.body?.lookupType || null,
      stepId: req.body?.stepId || req.body?.step || null,
    };
    console.log('[audit]', JSON.stringify(entry));
  });
  next();
}

module.exports = { auditLog };
