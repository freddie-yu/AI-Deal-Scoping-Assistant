import { afterEach, expect, it, vi } from 'vitest';
import { goldenSession, unitByName } from '../helpers/estimation.js';
import { calculateEstimate, estimateView } from '../../src/estimation/engine.js';
import { setConfig } from '../../src/estimation/config.js';
import * as math from '../../src/estimation/math.js';
import * as scheduling from '../../src/estimation/schedule.js';
const calculate = (s = goldenSession()) => calculateEstimate(s, '2026-09-27T00:00:00Z');
afterEach(() => vi.restoreAllMocks());

it('rate change executes only matching role pricing, skipping effort and schedule routines', () => {
  const before = calculate(), changed = structuredClone(before);
  setConfig(changed, 'rates.E', { amount: 90000, currency: 'USD', unit: 'minor-units/person-day' }, 'Reviewed rate', true);
  const effort = vi.spyOn(math, 'computeEffort'), pricing = vi.spyOn(math, 'computeCommercials'), schedule = vi.spyOn(scheduling, 'calculateSchedule');
  const result = estimateView(calculate(changed)), initial = estimateView(before);
  expect(effort).not.toHaveBeenCalled(); expect(schedule).not.toHaveBeenCalled();
  expect(pricing.mock.calls).toHaveLength(initial.items.filter(i => i.payload.roleEffort.some(r => r.roleId === 'E')).length);
  expect(pricing.mock.calls.every(([roles]) => Object.keys(roles).join() === 'E')).toBe(true);
  for (const old of initial.items) {
    const item = result.items.find(i => i.id === old.id)!;
    expect(item.payload.exactRoleEffort).toEqual(old.payload.exactRoleEffort);
    if (!old.payload.roleEffort.some(r => r.roleId === 'E')) expect(item).toEqual(old);
    expect(item.payload.moneyLedger.filter(r => r.roleId !== 'E')).toEqual(old.payload.moneyLedger.filter(r => r.roleId !== 'E'));
  }
  expect(result.summary!.commercials.total).toEqual({ low: 8453650, high: 13791950, unit: 'minor-units' });
});

it('contingency reuses every base row and physical slice without calling pricing or schedule', () => {
  const before = calculate(), changed = structuredClone(before);
  setConfig(changed, 'contingencyPercent', 20, 'Reviewed contingency', true);
  const effort = vi.spyOn(math, 'computeEffort'), pricing = vi.spyOn(math, 'computeCommercials'), schedule = vi.spyOn(scheduling, 'calculateSchedule');
  const result = estimateView(calculate(changed));
  expect(effort).not.toHaveBeenCalled(); expect(pricing).not.toHaveBeenCalled(); expect(schedule).not.toHaveBeenCalled();
  for (const old of estimateView(before).items) {
    const item = result.items.find(i => i.id === old.id)!;
    expect(item.payload.moneyLedger).toEqual(old.payload.moneyLedger);
    expect(item.payload.commercials.base).toEqual(old.payload.commercials.base);
    expect(item.payload.ledger.filter(l => !l.ruleStep.startsWith('Unit contingency'))).toEqual(old.payload.ledger.filter(l => !l.ruleStep.startsWith('Unit contingency')));
  }
  expect(result.summary!.commercials.total).toEqual({ low: 8400000, high: 13722000, unit: 'minor-units' });
});

it('currency invalidation does not run physical calculations or relabel USD prices', () => {
  const before = calculate(), changed = structuredClone(before);
  setConfig(changed, 'currency', { code: 'EUR', minorUnitDigits: 2 }, 'Reviewed currency', true);
  const effort = vi.spyOn(math, 'computeEffort'), schedule = vi.spyOn(scheduling, 'calculateSchedule');
  const result = estimateView(calculate(changed));
  expect(effort).not.toHaveBeenCalled(); expect(schedule).not.toHaveBeenCalled();
  expect(result.summary!.effort).toEqual(estimateView(before).summary!.effort);
  expect(result.summary!.workingDuration).toEqual(estimateView(before).summary!.workingDuration);
  expect(result.summary!.commercials.total).toBeNull(); expect(result.summary!.moneyLedger).toEqual([]);
});

it('INT_B recalculates ten units and an unchanged HIGH predicate stops testing propagation', () => {
  const before = calculate(), changed = structuredClone(before), id = unitByName(before, 'INT_B').id;
  setConfig(changed, `drivers.${id}.transformation`, true, 'Reconciliation required', true);
  const effort = vi.spyOn(math, 'computeEffort');
  const after = calculate(changed); expect(effort).toHaveBeenCalledTimes(10);
  for (const name of ['INT_A', 'INT_C']) {
    const unit = unitByName(before, name);
    expect(estimateView(after).items.find(i => i.payload.unitId === unit.id)).toEqual(estimateView(before).items.find(i => i.payload.unitId === unit.id));
  }
  effort.mockClear(); const next = structuredClone(after);
  setConfig(next, `drivers.${id}.asynchronous`, true, 'One more flag while HIGH', true);
  const final = calculate(next); expect(effort).not.toHaveBeenCalled();
  const testing = new Set(estimateView(after).units.filter(u => u.payload.unitType === 'TESTING').map(u => u.id));
  expect(estimateView(final).items.filter(i => testing.has(i.payload.unitId))).toEqual(estimateView(after).items.filter(i => testing.has(i.payload.unitId)));
});

it('repeated calculation reuses all numerical routines and clears a stale result after eligible refresh', () => {
  const before = calculate(), changed = structuredClone(before);
  const item = estimateView(changed).items[0]!; item.freshness = 'STALE'; item.staleCauses = [{ kind: 'CONFIGURATION', id: 'CFG_01', key: 'contingencyPercent' }];
  const effort = vi.spyOn(math, 'computeEffort'), pricing = vi.spyOn(math, 'computeCommercials'), schedule = vi.spyOn(scheduling, 'calculateSchedule');
  const after = calculate(changed);
  expect(effort).not.toHaveBeenCalled(); expect(pricing).not.toHaveBeenCalled(); expect(schedule).not.toHaveBeenCalled();
  expect(after.artifactSections[item.id]!.freshness).toBe('CURRENT');
  expect(after.artifactSections[item.id]!.payload).toEqual(item.payload);
});

it('accepted source refresh clears only reviewed derived units and preserves the accepted human artifact', () => {
  const before = calculate(), changed = structuredClone(before), unit = unitByName(changed, 'INT_B');
  const source = changed.artifactSections[unit.payload.source.kind === 'DOMAIN' ? unit.payload.source.sectionId : '']!;
  source.revision++; source.reviewedRevision = source.revision; source.lastChangedBy = 'HUMAN';
  if (source.payload.kind === 'Integration') source.payload.monitoring = { state: 'KNOWN', value: 'Accepted enhanced monitoring' };
  unit.freshness = 'STALE'; unit.staleCauses = [{ kind: 'ArtifactSection', id: source.id }];
  const snapshot = structuredClone(source), effort = vi.spyOn(math, 'computeEffort');
  const after = calculate(changed);
  expect(after.artifactSections[unit.id]!.freshness).toBe('CURRENT');
  expect(after.artifactSections[source.id]).toEqual(snapshot);
  expect(estimateView(after).summary!.effort).toEqual(estimateView(before).summary!.effort);
  expect(effort).not.toHaveBeenCalled();
  expect(after.artifactSections[unit.id]!.inputs.find(i => i.node.kind === 'ArtifactSection' && i.node.id === source.id)!.consumedRevision).toBe(source.revision);
});

it('source ineligibility and unreviewed unit boundaries cannot be healed by calculation', () => {
  const before = calculate(), changed = structuredClone(before), unit = unitByName(changed, 'INT_B');
  const source = changed.artifactSections[unit.payload.source.kind === 'DOMAIN' ? unit.payload.source.sectionId : '']!;
  source.review = 'PROPOSED'; unit.freshness = 'STALE';
  const after = calculate(changed);
  expect(after.artifactSections[unit.id]!.freshness).toBe('STALE');
  expect(estimateView(after).summary!.effort).toBeNull();
  source.review = 'REVIEWED'; unit.review = 'PROPOSED';
  expect(calculate(changed).artifactSections[unit.id]!.review).toBe('PROPOSED');
});

it('FULL audit independently detects a corrupted cached result while selective inputs remain unchanged', () => {
  const s = calculate(), item = estimateView(s).items[0]!;
  item.payload.effort = { low: 100, high: 200, unit: 'person-days' };
  item.payload.exactEffort = { low: '100', high: '200' };
  const effort = vi.spyOn(math, 'computeEffort');
  const audited = calculateEstimate(s, '2026-09-27T00:00:00Z', { mode: 'FULL' });
  expect(effort).toHaveBeenCalledTimes(24);
  expect(estimateView(audited).summary!.effort).toEqual({ low: 85, high: 140, unit: 'person-days' });
});

it('withdrawn schedule-input eligibility blocks reuse even when substantive hashes are unchanged', () => {
  const s = calculate(); s.configuration.entries['capacity.E']!.validation = 'UNVALIDATED';
  const effort = vi.spyOn(math, 'computeEffort');
  const result = estimateView(calculate(s));
  expect(effort).not.toHaveBeenCalled();
  expect(result.summary!.workingDuration).toBeNull();
  expect(result.summary!.missingInputs.some(m => m.node.kind === 'CONFIGURATION' && m.node.key === 'capacity.E')).toBe(true);
});

it('selective missing-rate results reproduce every substantive ledger field under FULL audit', () => {
  const s = calculate(); setConfig(s, 'rates.E', null, 'Rate absent', true);
  const selective = calculate(s), audit = calculateEstimate(selective, '2026-09-27T00:00:00Z', { mode: 'FULL' });
  const substantive = (value: unknown): unknown => Array.isArray(value) ? value.map(substantive) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'consumedRevision').map(([key, child]) => [key, substantive(child)])) : value;
  for (const item of estimateView(selective).items) expect(substantive(item.payload), item.id).toEqual(substantive(audit.artifactSections[item.id]!.payload));
});
