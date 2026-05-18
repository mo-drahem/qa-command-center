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
app.use('/api', apiKeyAuth);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/logger', loggerRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Centralized error middleware ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`QA Command Center backend running on http://localhost:${PORT}`);
});

module.exports = app;
