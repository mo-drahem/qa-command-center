const express = require('express');
const { fetchLogs } = require('../services/loggingApi');
const { generateNarrative } = require('../services/aiNarrative');

const router = express.Router();

/**
 * POST /api/logger/narrative
 * Body: { tracerId: string, environment: "dev" | "staging" }
 *
 * Returns:
 * {
 *   tracerId: string,
 *   environment: string,
 *   story: string,
 *   logs: LogEntry[]
 * }
 */
router.post('/narrative', async (req, res, next) => {
  try {
    const { tracerId, environment } = req.body;

    if (!tracerId || typeof tracerId !== 'string' || tracerId.trim() === '') {
      return res.status(400).json({ error: 'tracerId is required and must be a non-empty string.' });
    }

    const env = (environment || 'dev').trim().toLowerCase();
    if (!['dev', 'staging'].includes(env)) {
      return res.status(400).json({ error: 'environment must be "dev" or "staging".' });
    }

    const logs = await fetchLogs(tracerId.trim(), env);
    const story = await generateNarrative(logs);

    return res.json({
      tracerId: tracerId.trim(),
      environment: env,
      story,
      logs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
