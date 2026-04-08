require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const loggerRoutes = require('./routes/loggerRoutes');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/logger', loggerRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Centralized error middleware ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`QA Command Center backend running on http://localhost:${PORT}`);
});

module.exports = app;
