const { badRequest } = require('../lib/httpError');

function requireNonEmptyString(value, fieldName) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${fieldName} is required and must be a non-empty string.`);
  }
}

function validateNarrativePayload(req, _res, next) {
  try {
    requireNonEmptyString(req.body?.tracerId, 'tracerId');
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
