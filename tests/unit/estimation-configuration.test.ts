import { expect, it } from 'vitest';
import { ConfigurationSchema } from '../../src/domain/index.js';
import { demoConfiguration, setConfig } from '../../src/estimation/config.js';
import { goldenSession } from '../helpers/estimation.js';
it('demo baselines are unadjusted and unvalidated until explicitly reviewed', () => {
  const c = demoConfiguration(); expect(Object.values(c.entries).every(e => e.validation === 'UNVALIDATED')).toBe(true);
  expect(c.entries['baseEffort.INTEGRATION']).toMatchObject({ value: { state: 'KNOWN', value: { low: 3, high: 5, unit: 'person-days/unit' } } });
});
it.each([
  ['rates.E', { amount: 0, currency: 'USD', unit: 'minor-units/person-day' }],
  ['rates.E', { amount: -10, currency: 'USD', unit: 'minor-units/person-day' }],
  ['rates.E', { amount: .5, currency: 'USD', unit: 'minor-units/person-day' }],
  ['baseEffort.APPLICATION', { low: 8, high: 4, unit: 'person-days/unit' }],
  ['baseEffort.APPLICATION', { low: 0, high: 4, unit: 'person-days/unit' }],
  ['roleAllocation.APPLICATION', { E: .9999999999 }],
  ['contingencyPercent', -1], ['contingencyPercent', 101], ['capacity.E', -1],
  ['productivity.APPLICATION', 0], ['complexityMultipliers.LOW', 0],
  ['workingWeekdays', []], ['holidays', ['2026-02-30']], ['wait.implementation', { low: -1, high: 0, unit: 'working-days' }],
])('rejects invalid %s', (key, value) => {
  const s = goldenSession(); setConfig(s, key as string, value, 'Invalid fixture', true);
  expect(ConfigurationSchema.safeParse(s.configuration).success).toBe(false);
});
