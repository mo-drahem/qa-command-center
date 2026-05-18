import client from './client';

/**
 * Generate a QA narrative from tracer logs.
 *
 * @param {string} tracerId - The tracer ID to look up.
 * @param {'dev'|'staging'} environment - Target environment.
 * @returns {Promise<{ tracerId: string, environment: string, story: string, insights?: object, aiProvider?: string, aiReason?: string, tokenUsage?: { provider: string, promptTokens: number, completionTokens: number, totalTokens: number } | null, mathValidation?: object, logs: object[] }>}
 */
export async function generateNarrative(tracerId, environment) {
  const response = await client.post('/logger/narrative', { tracerId, environment });
  return response.data;
}

/**
 * Lookup OMS entities by identifier.
 *
 * @param {'dev'|'staging'} environment
 * @param {'orderNumber'|'orderId'|'cartId'|'saleId'|'couponCodes'} lookupType
 * @param {string} value
 * @returns {Promise<{ environment: string, lookupType: string, value: string, sourceUrl: string, data: any }>}
 */
export async function lookupOmsData(environment, lookupType, value) {
  const response = await client.post('/logger/lookup', { environment, lookupType, value });
  return response.data;
}

/**
 * Check conflicts between a new coupon and existing active coupons.
 *
 * @param {'dev'|'staging'} environment
 * @param {object} newCoupon
 * @returns {Promise<{ environment: string, sourceUrl: string, existingCouponsCount: number, analysis: object }>}
 */
export async function checkCouponConflicts(environment, newCoupon) {
  const response = await client.post('/logger/coupon-conflicts', { environment, newCoupon });
  return response.data;
}

/**
 * Simulate promotion-risk edge cases before deploying a new rule.
 *
 * @param {'dev'|'staging'} environment
 * @param {string} newRule
 * @param {string} activeRules
 * @returns {Promise<{ environment: string, provider: string, reason?: string, result: any }>}
 */
export async function simulatePromotionRisk(environment, newRule, activeRules) {
  const response = await client.post('/logger/promotion-risk', { environment, newRule, activeRules });
  return response.data;
}

/**
 * Execute one business scenario step.
 *
 * @param {'dev'|'staging'} environment
 * @param {'createCart'|'prepare'|'checkout'} step
 * @param {{ cartId?: string, saleId?: string, appId?: string }} payload
 * @returns {Promise<{ environment: string, step: string, sourceUrl: string, data: any }>}
 */
export async function runBusinessScenarioStep(environment, step, payload = {}) {
  const response = await client.post('/logger/business-scenario-step', {
    environment,
    step,
    ...payload,
  });
  return response.data;
}

export async function getBusinessActions() {
  const response = await client.get('/logger/business-actions');
  return response.data;
}

export async function getBusinessActionDraft(environment, actionId, runtime = {}) {
  const response = await client.get(`/logger/business-actions/${encodeURIComponent(actionId)}/draft`, {
    params: { environment, runtime: JSON.stringify(runtime) },
  });
  return response.data;
}

export async function executeBusinessAction(environment, actionId, runtime = {}, override = {}) {
  const response = await client.post('/logger/business-actions/execute', {
    environment,
    actionId,
    runtime,
    override,
  });
  return response.data;
}

export async function getFastTrackScenarios() {
  const response = await client.get('/logger/fast-track/scenarios');
  return response.data;
}

export async function getAddFlightProductBodyTemplate() {
  const response = await client.get('/logger/fast-track/templates/add-flight-product-body');
  return response.data;
}

export async function getAddHotelProductBodyTemplate() {
  const response = await client.get('/logger/fast-track/templates/add-hotel-product-body');
  return response.data;
}

export async function getPrepareBodyTemplate() {
  const response = await client.get('/logger/fast-track/templates/prepare-body');
  return response.data;
}

export async function executeFastTrackStep(environment, stepId, runtime = {}, override = {}) {
  const response = await client.post('/logger/fast-track/execute', {
    environment,
    stepId,
    runtime,
    override,
  });
  return response.data;
}
