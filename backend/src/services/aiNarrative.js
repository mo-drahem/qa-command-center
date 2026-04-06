const axios = require('axios');
const { env } = require('../config/env');

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are a QA expert. Summarize API calls into a chronological User Story. ' +
  'Explain flow, where it stopped, and errors in plain English. ' +
  'Keep output readable with short sections and bullet points.';

// ─── Copilot / OpenAI-compatible provider ─────────────────────────────────────

async function callCopilotApi(logs) {
  const apiKey = env.COPILOT_API_KEY;
  const model = env.COPILOT_MODEL || 'gpt-4o';

  // Build a compact log summary to keep the prompt short
  const logLines = logs
    .map(
      (l, i) =>
        `${i + 1}. [${l.timestamp || 'N/A'}] ${l.method || 'GET'} ${l.requestURI} ` +
        `→ ${l.statusCode || '?'} (${l.serviceName})`
    )
    .join('\n');

  const userMessage =
    `Here are the API call logs for tracer ID "${logs[0]?.tracerId || 'unknown'}":\n\n` +
    logLines +
    '\n\nPlease provide a QA User Story narrative.';

  const response = await axios.post(
    'https://api.githubcopilot.com/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const choice = response.data?.choices?.[0];
  return choice?.message?.content || null;
}

// ─── Local fallback summarizer ────────────────────────────────────────────────

function buildFallbackSummary(logs, fallbackReason) {
  if (!logs || logs.length === 0) {
    return (
      '**Fallback Summary** *(AI provider unavailable)*\n\n' +
      `_Reason: ${fallbackReason}_\n\n` +
      'No log entries were found for this tracer ID.'
    );
  }

  // Sort by timestamp ascending (best-effort)
  const sorted = [...logs].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  const lastCall = sorted[sorted.length - 1];
  const errors = sorted.filter((l) => Number(l.statusCode) >= 400);
  const hasErrors = errors.length > 0;

  const timeline = sorted
    .map(
      (l, i) =>
        `  ${i + 1}. **${l.method || 'GET'} ${l.requestURI}** ` +
        `(${l.serviceName}) — ${l.statusCode || 'N/A'} @ ${l.timestamp || 'N/A'}`
    )
    .join('\n');

  const errorSection = hasErrors
    ? '\n\n### ⚠️ Errors Detected\n' +
      errors
        .map(
          (l) =>
            `- HTTP **${l.statusCode}** on \`${l.requestURI}\` (${l.serviceName}) at ${l.timestamp || 'N/A'}`
        )
        .join('\n')
    : '\n\n### ✅ No Errors Detected\nAll captured calls returned successful status codes.';

  return (
    `## Fallback QA Narrative *(AI provider unavailable)*\n\n` +
    `> _Reason: ${fallbackReason}_\n\n` +
    `### Flow Timeline\n${timeline}\n\n` +
    `### Stop Point\nThe last captured call was:\n` +
    `- **${lastCall.method || 'GET'} ${lastCall.requestURI}** (${lastCall.serviceName}) ` +
    `— Status **${lastCall.statusCode || 'N/A'}** at \`${lastCall.timestamp || 'N/A'}\`` +
    errorSection
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generate a narrative story from an array of log entries.
 * Always resolves – never rejects. Falls back to local summary on any AI failure.
 */
async function generateNarrative(logs) {
  // Attempt Copilot/AI provider only when an API key is configured
  if (env.COPILOT_API_KEY) {
    try {
      const story = await callCopilotApi(logs);
      if (story) {
        return story;
      }
      return buildFallbackSummary(
        logs,
        'AI provider returned an empty response'
      );
    } catch (err) {
      const reason = err.response
        ? `AI provider responded with HTTP ${err.response.status}: ${err.response.statusText}`
        : `AI provider unreachable – ${err.message}`;
      return buildFallbackSummary(logs, reason);
    }
  }

  // No API key configured → use fallback directly
  return buildFallbackSummary(
    logs,
    'No AI provider API key configured (COPILOT_API_KEY is not set)'
  );
}

module.exports = { generateNarrative };
