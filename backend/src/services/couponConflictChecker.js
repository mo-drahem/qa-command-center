const axios = require('axios');

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function pickCouponsFromResponse(responseData) {
  if (Array.isArray(responseData)) return responseData;
  if (responseData && Array.isArray(responseData.data)) return responseData.data;
  if (responseData && Array.isArray(responseData.body)) return responseData.body;
  if (responseData && Array.isArray(responseData.result)) return responseData.result;
  return [];
}

function flattenCouponEntries(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenCouponEntries(item, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;

  // A coupon-like object usually has one of these keys.
  const looksLikeCoupon =
    Object.prototype.hasOwnProperty.call(value, 'code') ||
    Object.prototype.hasOwnProperty.call(value, 'couponCode') ||
    Object.prototype.hasOwnProperty.call(value, 'condition') ||
    Object.prototype.hasOwnProperty.call(value, 'ruleType');

  if (looksLikeCoupon) out.push(value);

  Object.keys(value).forEach((k) => {
    const child = value[k];
    if (Array.isArray(child) || (child && typeof child === 'object')) {
      flattenCouponEntries(child, out);
    }
  });
  return out;
}

function couponIdentifiers(coupon) {
  const values = new Set();
  const add = (v) => {
    const n = normalizeString(v);
    if (n) values.add(n);
  };

  if (typeof coupon === 'string') {
    add(coupon);
    return [...values];
  }
  if (!coupon || typeof coupon !== 'object') return [];

  add(coupon.code);
  add(coupon.name);
  normalizeArray(coupon.couponCode).forEach(add);
  return [...values];
}

function normalizeCondition(condition) {
  return {
    operator: normalizeString(condition?.operator),
    cartVariable: normalizeString(condition?.cartVariable),
    value: normalizeString(condition?.value),
  };
}

function conditionKey(condition) {
  const c = normalizeCondition(condition);
  return `${c.operator}|${c.cartVariable}|${c.value}`;
}

function findMatchedConditions(newCouponConditions, existingCouponConditions) {
  const newNormalized = normalizeArray(newCouponConditions)
    .map(normalizeCondition)
    .filter((c) => c.operator || c.cartVariable || c.value);
  const existingNormalized = normalizeArray(existingCouponConditions)
    .map(normalizeCondition)
    .filter((c) => c.operator || c.cartVariable || c.value);

  if (newNormalized.length === 0 || existingNormalized.length === 0) {
    return [];
  }

  const existingMap = new Map();
  existingNormalized.forEach((c) => {
    existingMap.set(conditionKey(c), c);
  });

  return newNormalized.filter((c) => existingMap.has(conditionKey(c)));
}

function analyzeConflicts(newCoupon, existingCoupons) {
  const findings = [];
  const newIds = new Set(couponIdentifiers(newCoupon));
  const newCode = normalizeString(newCoupon?.code) || normalizeString(newCoupon?.name);

  const couponEntries = flattenCouponEntries(existingCoupons);

  couponEntries.forEach((coupon) => {
    const existingIds = couponIdentifiers(coupon);
    const existingCode = normalizeString(coupon?.code) || normalizeString(coupon?.name);

    const duplicateCode = existingIds.some((id) => newIds.has(id));

    if (duplicateCode) {
      findings.push({
        severity: 'critical',
        couponCode: coupon?.code || coupon?.name || '(unknown)',
        type: 'duplicate_code',
        message: `Coupon already exists with code/couponCode "${coupon?.code || coupon?.name || 'unknown'}".`,
      });
    }

    const matchedConditions = findMatchedConditions(newCoupon?.condition, coupon?.condition);
    if (matchedConditions.length > 0) {
      findings.push({
        severity: 'critical',
        couponCode: coupon?.code || coupon?.name || '(unknown)',
        type: 'condition_match',
        message: `Condition match found with existing coupon "${coupon?.code || coupon?.name || 'unknown'}".`,
        matchedConditions,
      });
    }
  });

  const uniqueFindings = [];
  const seen = new Set();
  findings.forEach((f) => {
    const key = `${f.type}|${f.couponCode}|${f.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFindings.push(f);
    }
  });

  const hasCritical = uniqueFindings.some((f) => f.severity === 'critical');
  return {
    verdict: hasCritical ? 'BLOCK' : 'SAFE_TO_PROCEED',
    findings: uniqueFindings,
    summary: {
      totalFindings: uniqueFindings.length,
      critical: uniqueFindings.filter((f) => f.severity === 'critical').length,
      high: 0,
      scannedCoupons: couponEntries.length,
      inputCouponCode: newCode || null,
    },
  };
}

async function checkCouponConflicts({ environment, newCoupon }) {
  const envKey = environment === 'staging' ? 'staging' : 'dev';
  const url = `http://oms-v2-pricing-core-service.tajawal-${envKey}.internal/coupon`;

  const response = await axios.get(url, { timeout: 20000 });
  const coupons = pickCouponsFromResponse(response.data);
  const analysis = analyzeConflicts(newCoupon, coupons);

  return {
    sourceUrl: url,
    existingCouponsCount: coupons.length,
    analysis,
  };
}

module.exports = {
  checkCouponConflicts,
  analyzeConflicts,
  couponIdentifiers,
  findMatchedConditions,
};

