import { describe, it, expect } from 'vitest';
import { applyVitalField, extractVitalValues, setAtPath, substituteRuntimeInUrl } from './businessRequest';

describe('businessRequest', () => {
  it('setAtPath nests correctly', () => {
    const body = setAtPath({}, ['contact', 'email'], 'a@b.com');
    expect(body.contact.email).toBe('a@b.com');
  });

  it('applyVitalField updates header', () => {
    const fields = [{ id: 'appId', label: 'app-id', target: 'header', key: 'app-id' }];
    const { headers } = applyVitalField(fields, 'appId', '99', {}, {});
    expect(headers['app-id']).toBe('99');
  });

  it('extractVitalValues updates when body JSON path changes', () => {
    const fields = [{ id: 'total', label: 'Total', target: 'body', path: ['total'] }];
    const first = extractVitalValues(fields, {}, { total: 10 });
    const second = extractVitalValues(fields, {}, { total: 99 });
    expect(first.total).toBe('10');
    expect(second.total).toBe('99');
  });

  it('applyVitalField parses boolean body values', () => {
    const fields = [{ id: 'mdrEnabled', label: 'mdrEnabled', target: 'body', path: ['mdrEnabled'] }];
    const { body } = applyVitalField(fields, 'mdrEnabled', 'false', {}, { mdrEnabled: true });
    expect(body.mdrEnabled).toBe(false);
  });

  it('substituteRuntimeInUrl replaces rule-id placeholder', () => {
    const url = 'http://host/mdr/export-csv/<rule-id>';
    expect(substituteRuntimeInUrl(url, { ruleId: '6a0996c6f81d20586f29f59c' })).toContain(
      '/mdr/export-csv/6a0996c6f81d20586f29f59c',
    );
  });

  it('extractVitalValues reads header and body', () => {
    const fields = [
      { id: 'appId', label: 'app-id', target: 'header', key: 'app-id' },
      { id: 'total', label: 'Total', target: 'body', path: ['total'] },
    ];
    const values = extractVitalValues(fields, { 'app-id': '50' }, { total: 100 });
    expect(values.appId).toBe('50');
    expect(values.total).toBe('100');
  });
});
