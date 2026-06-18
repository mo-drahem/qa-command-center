const { badRequest } = require('../lib/httpError');

function requireNonEmptyString(value, fieldName) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${fieldName} is required and must be a non-empty string.`);
  }
}

const NARRATIVE_FOCUS_PROMPT_MAX_CHARS = 2000;
const NARRATIVE_LOGS_MAX_ENTRIES = 200;
const { MAX_LOG_TEXT_CHARS } = require('../services/grafanaLogTextParser');

function validateNarrativePayload(req, _res, next) {
  try {
    const { tracerId, logs, logText, focusPrompt, source, grafanaQuery } = req.body || {};
    const hasLogs = Array.isArray(logs) && logs.length > 0;
    const hasTracerId = typeof tracerId === 'string' && tracerId.trim();
    const hasLogText = typeof logText === 'string' && logText.trim();
    const isGrafanaSource = source === 'grafana';
    const hasGrafanaQuery = typeof grafanaQuery === 'string' && grafanaQuery.trim();

    if (isGrafanaSource) {
      if (!hasGrafanaQuery && !hasTracerId) {
        throw badRequest('grafanaQuery or tracerId is required when source is grafana.');
      }
    } else if (!hasLogs && !hasLogText && !hasTracerId) {
      throw badRequest('tracerId, logs, or logText is required.');
    }
    if (logText !== undefined && logText !== null && typeof logText !== 'string') {
      throw badRequest('logText must be a string.');
    }
    if (hasLogText && logText.length > MAX_LOG_TEXT_CHARS) {
      throw badRequest(`logText must be at most ${MAX_LOG_TEXT_CHARS} characters.`);
    }
    if (grafanaQuery !== undefined && grafanaQuery !== null && typeof grafanaQuery !== 'string') {
      throw badRequest('grafanaQuery must be a string.');
    }
    if (source !== undefined && source !== null && source !== 'grafana' && source !== 'logging-api') {
      throw badRequest('source must be grafana or logging-api.');
    }
    if (hasLogs && logs.length > NARRATIVE_LOGS_MAX_ENTRIES) {
      throw badRequest(`logs must contain at most ${NARRATIVE_LOGS_MAX_ENTRIES} entries.`);
    }
    if (focusPrompt !== undefined && focusPrompt !== null) {
      if (typeof focusPrompt !== 'string') {
        throw badRequest('focusPrompt must be a string.');
      }
      if (focusPrompt.length > NARRATIVE_FOCUS_PROMPT_MAX_CHARS) {
        throw badRequest(`focusPrompt must be at most ${NARRATIVE_FOCUS_PROMPT_MAX_CHARS} characters.`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

function validateLookupPayload(req, _res, next) {
  try {
    const { lookupType, value } = req.body || {};
    requireNonEmptyString(lookupType, 'lookupType');
    if (lookupType !== 'couponCodes') {
      requireNonEmptyString(value, 'value');
    }
    next();
  } catch (error) {
    next(error);
  }
}

function validateFastTrackPayload(req, _res, next) {
  try {
    requireNonEmptyString(req.body?.stepId, 'stepId');
    next();
  } catch (error) {
    next(error);
  }
}

function validateBusinessActionPayload(req, _res, next) {
  try {
    requireNonEmptyString(req.body?.actionId, 'actionId');
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateNarrativePayload,
  validateLookupPayload,
  validateFastTrackPayload,
  validateBusinessActionPayload,
};
