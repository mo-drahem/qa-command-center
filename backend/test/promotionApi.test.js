const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const promotionApi = require('../src/services/promotionApi');

const originalGet = axios.get;

describe('promotionApi', () => {
  it('getRules calls GET pricing-core /rule', async () => {
    let captured;
    axios.get = async (url, config) => {
      captured = { url, config };
      return { status: 200, data: [{ code: 'RULE-1' }] };
    };
    try {
      const result = await promotionApi.getRules({ environment: 'dev' });
      assert.match(captured.url, /oms-v2-pricing-core-service\.tajawal-dev\.internal\/rule$/);
      assert.equal(captured.config.headers['client-id'], 'nibz');
      assert.equal(result.responseStatus, 200);
      assert.equal(result.data[0].code, 'RULE-1');
    } finally {
      axios.get = originalGet;
    }
  });

  it('getRuleById calls GET pricing-core /rule/{id}', async () => {
    let captured;
    axios.get = async (url) => {
      captured = { url };
      return { status: 200, data: { code: 'RULE-1' } };
    };
    try {
      await promotionApi.getRuleById({
        environment: 'dev',
        ruleId: '6a0996c6f81d20586f29f59c',
      });
      assert.match(captured.url, /\/rule\/6a0996c6f81d20586f29f59c$/);
    } finally {
      axios.get = originalGet;
    }
  });

  it('getCoupons calls GET pricing-core /coupon', async () => {
    let captured;
    axios.get = async (url) => {
      captured = { url };
      return { status: 200, data: [] };
    };
    try {
      await promotionApi.getCoupons({ environment: 'staging' });
      assert.match(captured.url, /tajawal-staging\.internal\/coupon$/);
    } finally {
      axios.get = originalGet;
    }
  });

  it('getCouponById calls GET pricing-core /coupon/{id}', async () => {
    let captured;
    axios.get = async (url) => {
      captured = { url };
      return { status: 200, data: { code: 'COUPON-1' } };
    };
    try {
      await promotionApi.getCouponById({ environment: 'dev', couponId: 'abc123' });
      assert.match(captured.url, /\/coupon\/abc123$/);
    } finally {
      axios.get = originalGet;
    }
  });

  it('getMdrOfRule calls GET pricing-mdr export-csv', async () => {
    let captured;
    axios.get = async (url, config) => {
      captured = { url, config };
      return { status: 200, data: 'a,b\n1,2' };
    };
    try {
      const result = await promotionApi.getMdrOfRule({
        environment: 'dev',
        ruleId: '6a0996c6f81d20586f29f59c',
      });
      assert.match(
        captured.url,
        /oms-v2-pricing-mdr-service\.tajawal-dev\.internal\/mdr\/export-csv\/6a0996c6f81d20586f29f59c$/,
      );
      assert.equal(result.data.format, 'csv');
      assert.equal(result.data.lineCount, 2);
    } finally {
      axios.get = originalGet;
    }
  });

  it('getRuleById rejects invalid rule id', async () => {
    await assert.rejects(
      () => promotionApi.getRuleById({ environment: 'dev', ruleId: 'not-valid' }),
      /24-character hex/,
    );
  });
});
