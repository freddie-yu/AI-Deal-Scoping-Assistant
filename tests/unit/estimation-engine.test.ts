import { expect, it } from 'vitest';
import { goldenSession, unitByName } from '../helpers/estimation.js';
import { calculateEstimate, estimateView } from '../../src/estimation/engine.js';
import { setConfig } from '../../src/estimation/config.js';
import { ScopingSessionSchema } from '../../src/domain/index.js';
const calculate = (s = goldenSession()) => calculateEstimate(s, '2026-09-23T00:00:00Z');
it('§9 reproduces effort, role sums, authoritative ROM, schedule and headlines', () => {
  const s = calculate(); const v = estimateView(s); const summary = v.summary!;
  expect(summary.effort).toEqual({ low: 85, high: 140, unit: 'person-days' });
  expect(summary.commercials.total).toEqual({ low: 8050000, high: 13150250, unit: 'minor-units' });
  expect(summary.workingDuration).toEqual({ low: 61, high: 99, unit: 'working-days' });
  expect(summary.finishDates).toEqual({ low: '2026-12-28', high: '2027-02-18' });
  expect(summary.phases[0]!.startDates).toEqual({ low: '2026-10-05', high: '2026-10-05' });
  expect(summary.phases[0]!.finishDates).toEqual({ low: '2026-10-16', high: '2026-10-26' });
  expect(summary.phases.at(-1)!.milestones[0]!.dates).toEqual(summary.finishDates);
  expect(summary.presentation?.rom).toEqual({ low: 80000, high: 132000, unit: 'USD' });
  expect(summary.confidence).toBe('MEDIUM');
  expect(ScopingSessionSchema.safeParse(s).success).toBe(true);
});
it('U2 INT_B changes once; INT_A/C remain byte-identical and nine testing rows change', () => {
  const before = calculate(); const u = unitByName(before, 'INT_B');
  const changed = structuredClone(before); setConfig(changed, `drivers.${u.id}.transformation`, true, 'Reviewed reconciliation required', true);
  const after = calculate(changed); const a = estimateView(before), b = estimateView(after);
  expect(b.summary!.effort).toEqual({ low: 91, high: 151.5, unit: 'person-days' });
  expect(b.summary!.commercials.total).toEqual({ low: 8522650, high: 14048400, unit: 'minor-units' });
  expect(b.summary!.workingDuration).toEqual({ low: 65, high: 107, unit: 'working-days' });
  for (const name of ['INT_A', 'INT_C']) { const id = unitByName(before, name).id; expect(b.items.find(i => i.payload.unitId === id)).toEqual(a.items.find(i => i.payload.unitId === id)); }
  expect(b.items.filter(i => JSON.stringify(i.payload) !== JSON.stringify(a.items.find(j => j.id === i.id)?.payload))).toHaveLength(10);
});
it('rate edits preserve labor, contingency edits preserve base, currency edits do not invent FX', () => {
  const before = calculate(); const v = estimateView(before); const rate = structuredClone(before);
  setConfig(rate, 'rates.E', { amount: 90000, currency: 'USD', unit: 'minor-units/person-day' }, 'Reviewed new rate', true);
  const r = estimateView(calculate(rate)); expect(r.summary!.effort).toEqual(v.summary!.effort); expect(r.summary!.commercials.total).not.toEqual(v.summary!.commercials.total);
  const cont = structuredClone(before); setConfig(cont, 'contingencyPercent', 20, 'Reviewed contingency', true);
  const c = estimateView(calculate(cont)); expect(c.summary!.commercials.base).toEqual(v.summary!.commercials.base); expect(c.summary!.timeline).toEqual(v.summary!.timeline); expect(c.summary!.commercials.total).not.toEqual(v.summary!.commercials.total);
  const currency = structuredClone(before); setConfig(currency, 'currency', { code: 'EUR', minorUnitDigits: 2 }, 'Reviewed currency', true);
  const e = estimateView(calculate(currency)); expect(e.summary!.effort).toEqual(v.summary!.effort); expect(e.summary!.commercials.total).toBeNull(); expect(e.summary!.confidenceByMetric.effort).toBe('MEDIUM'); expect(e.summary!.confidenceByMetric.commercials).toBe('LOW');
});
it('missing selected multiplier blocks affected labor but retains known partial subtotals', () => {
  const s = goldenSession(); delete s.configuration.entries['complexityMultipliers.MEDIUM'];
  const v = estimateView(calculate(s)); expect(v.summary!.effort).toBeNull(); expect(v.summary!.knownSubtotals!.effort.low).toBe(7);
  expect(v.summary!.missingInputs.some(m => m.node.kind === 'CONFIGURATION' && m.node.key === 'complexityMultipliers.MEDIUM')).toBe(true);
});
it('display regrouping and repeated calculation preserve numerical ledgers/results', () => {
  const s = calculate(); const initial = estimateView(s);
  for (const a of Object.values(s.artifactSections)) if (a.payload.kind === 'Workstream') { a.payload.name = 'New display name'; a.payload.displayGroups = ['A', 'B', 'A']; }
  const after = estimateView(calculate(s)); expect(after.items).toEqual(initial.items); expect(after.summary!.effort).toEqual(initial.summary!.effort); expect(after.summary!.commercials).toEqual(initial.summary!.commercials);
  expect(calculate(s)).toEqual(calculate(s));
});
