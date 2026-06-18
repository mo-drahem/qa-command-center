import client from './client';

/**
 * Generate a QA narrative from tracer logs.
 *
 * @param {string} tracerId - The tracer ID to look up (optional when logs are pasted).
 * @param {'dev'|'staging'|'production'} environment - Target environment.
 * @param {{ focusPrompt?: string, logs?: object[], logText?: string, source?: 'logging-api'|'grafana', grafanaQuery?: string, from?: string, to?: string }} [options]
 * @returns {Promise<{ tracerId: string, environment: string, story: string, insights?: object, aiProvider?: string, aiReason?: string, tokenUsage?: { provider: string, promptTokens: number, completionTokens: number, totalTokens: number } | null, mathValidation?: object, logs: object[] }>}
 */
export async function generateNarrative(tracerId, environment, options = {}) {
  const body = { environment };
  const focusPrompt = options.focusPrompt?.trim();
  if (focusPrompt) body.focusPrompt = focusPrompt;
  if (options.logText?.trim()) body.logText = options.logText.trim();
  if (options.source === 'grafana') body.source = 'grafana';
  if (options.grafanaQuery?.trim()) body.grafanaQuery = options.grafanaQuery.trim();
  if (options.from) body.from = options.from;
  if (options.to) body.to = options.to;
  if (Array.isArray(options.logs) && options.logs.length > 0) {
    body.logs = options.logs;
    if (tracerId?.trim()) body.tracerId = tracerId.trim();
  } else if (!body.logText && (options.source !== 'grafana' || tracerId?.trim())) {
    body.tracerId = tracerId;
  }
  const response = await client.post('/logger/narrative', body);
  return response.data;
}

export async function getGrafanaConfig(environment) {
  const response = await client.get('/logger/grafana-config', { params: { environment } });
  return response.data;
}

/**
 * Lookup OMS entities by identifier.
 *
 * @param {'dev'|'staging'|'production'} environment
 * @param {'orderNumber'|'orderId'|'cartId'|'saleId'|'couponCodes'} lookupType
 * @param {string} value
 * @returns {Promise<{ environment: string, lookupType: string, value: string, sourceUrl: string, data: any }>}
 */
export async function lookupOmsData(environment, lookupType, value) {
  const response = await client.post('/logger/lookup', { environment, lookupType, value });
  return response.data;
}

export async function getPromotionRules(environment) {
  const response = await client.post('/logger/promotions/rules', { environment });
  return response.data;
}

export async function getPromotionRuleById(environment, ruleId) {
  const response = await client.post('/logger/promotions/rule', { environment, ruleId });
  return response.data;
}

export async function getPromotionCoupons(environment) {
  const response = await client.post('/logger/promotions/coupons', { environment });
  return response.data;
}

export async function getPromotionCouponById(environment, couponId) {
  const response = await client.post('/logger/promotions/coupon', { environment, couponId });
  return response.data;
}

export async function getPromotionMdr(environment, ruleId) {
  const response = await client.post('/logger/promotions/mdr', { environment, ruleId });
  return response.data;
}

/**
 * Execute one business scenario step.
 *
 * @param {'dev'|'staging'|'production'} environment
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
