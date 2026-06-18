const path = require('path');
const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const loggerRoutes = require('./routes/loggerRoutes');
const { requestContext } = require('./middleware/requestContext');
const { errorHandler } = require('./middleware/errorHandler');
const { apiKeyAuth } = require('./middleware/apiKeyAuth');
const { auditLog } = require('./middleware/auditLog');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestContext);
app.use(auditLog);

// Public runtime flags (must stay outside API key auth)
app.get('/api/runtime-config', (_req, res) => {
  res.json({
    requiresApiKey: Boolean(String(env.QA_CENTER_API_KEY || '').trim()),
  });
});

app.use('/api', apiKeyAuth);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/logger', loggerRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Frontend (production / Docker) ───────────────────────────────────────────
if (env.SERVE_FRONTEND) {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/health).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Centralized error middleware ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`QA Command Center backend running on http://localhost:${PORT}`);
});

module.exports = app;
