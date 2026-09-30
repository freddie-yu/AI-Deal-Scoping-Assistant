import { expect, it } from 'vitest';
import { goldenSession, unitByName } from '../helpers/estimation.js';
import { calculateEstimate, estimateView } from '../../src/estimation/engine.js';
import { setConfig, resolveConfig } from '../../src/estimation/config.js';
import { reconcileUnits, units } from '../../src/estimation/reconcile.js';
import { ScopingSessionSchema } from '../../src/domain/index.js';
import { scopeCoverage } from '../../src/traceability/coverage.js';
const calc = (s = goldenSession()) => calculateEstimate(s, '2026-09-24T00:00:00Z');
it('review eligibility blocks new source use without rewriting the historical estimate', () => {
  const s = calc(), unit = unitByName(s, 'INT_B'); const original = estimateView(s).items.find(i => i.payload.unitId === unit.id)!;
  if (unit.payload.source.kind === 'DOMAIN') s.artifactSections[unit.payload.source.sectionId]!.review = 'PROPOSED';
  const next = calc(s);
  expect(estimateView(next).items.find(i => i.payload.unitId === unit.id)).toEqual(original);
  expect(estimateView(next).summary!.effort).toBeNull();
  expect(estimateView(next).summary!.missingInputs.some(m => m.reason.includes('eligible'))).toBe(true);
});
it('retired unit activity is zero and excludes its testing unit', () => {
  const s = goldenSession(), unit = unitByName(s, 'INT_B'); s.artifactSections[unit.id]!.lifecycle = 'RETIRED';
  const next = calc(s); expect(estimateView(next).items.find(i => i.payload.unitId === unit.id)!.payload.effort?.high).toBe(0);
  const test = units(next).find(u => u.payload.source.kind === 'TEST_TARGET' && u.payload.source.unitId === unit.id)!;
  expect(estimateView(next).items.find(i => i.payload.unitId === test.id)!.payload.effort?.high).toBe(0);
});
it('rejects excluded quantity one and bad source pairing rather than pricing inconsistent scope', () => {
  const s = goldenSession(), unit = unitByName(s, 'INT_B'); unit.payload.inclusion = { state: 'KNOWN', value: 'EXCLUDED' }; unit.payload.exclusionReason = 'Removed';
  expect(ScopingSessionSchema.safeParse(s).success).toBe(false);
  const other = goldenSession(), u = unitByName(other, 'INT_B'); u.payload.source = { kind: 'DOMAIN', sectionId: Object.values(other.artifactSections).find(a => a.payload.kind === 'DataDomain')!.id };
  expect(ScopingSessionSchema.safeParse(other).success).toBe(false);
});
it.each(['baseEffort.INTEGRATION', 'productivity.INTEGRATION', 'roleAllocation.INTEGRATION', 'complexityMultipliers.MEDIUM'])('missing %s blocks affected unit effort', key => {
  const s = goldenSession(); delete s.configuration.entries[key]; const unit = unitByName(s, 'INT_B');
  const view = estimateView(calc(s)); expect(view.items.find(i => i.payload.unitId === unit.id)!.payload.effort).toBeNull(); expect(view.summary!.knownSubtotals!.effort.low).toBeGreaterThan(0);
});
it('unknown driver propagates unresolved shared testing predicate, never false', () => {
  const s = goldenSession(), unit = unitByName(s, 'INT_B'); setConfig(s, `drivers.${unit.id}.transformation`, null, 'Unknown', true);
  const next = calc(s); const test = units(next).find(a => a.payload.unitType === 'TESTING')!;
  expect(test.payload.complexity.band.state).toBe('UNRESOLVED');
  expect(estimateView(next).summary!.effort).toBeNull();
});
it('an unchanged testing predicate does not reprice testing when another integration becomes HIGH', () => {
  const s = goldenSession(); const a = unitByName(s, 'INT_A'), b = unitByName(s, 'INT_B'); setConfig(s, `drivers.${a.id}.transformation`, true, 'Reviewed', true);
  const before = calc(s); setConfig(before, `drivers.${b.id}.transformation`, true, 'Reviewed', true); const after = calc(before);
  const ids = units(before).filter(u => u.payload.unitType === 'TESTING').map(u => u.id);
  expect(estimateView(after).items.filter(i => ids.includes(i.payload.unitId))).toEqual(estimateView(before).items.filter(i => ids.includes(i.payload.unitId)));
});
it('unknown inventory suppresses full totals and infrastructure-only solution gets one fallback test', () => {
  const s = goldenSession(); setConfig(s, 'inventoryComplete.INTEGRATION', null, 'Unknown inventory', true);
  expect(estimateView(calc(s)).summary!.effort).toBeNull();
  let infra = goldenSession(); for (const a of Object.values(infra.artifactSections)) if (['Capability', 'Integration', 'AIUseCase'].includes(a.payload.kind)) a.lifecycle = 'RETIRED';
  for (const a of units(infra)) if (a.payload.unitType === 'DATA') { a.payload.inclusion = { state: 'KNOWN', value: 'EXCLUDED' }; a.payload.exclusionReason = 'No migration'; }
  infra = reconcileUnits(infra); for (const e of Object.values(infra.configuration.entries)) e.validation = 'VALIDATED'; infra = reconcileUnits(infra);
  expect(units(infra).filter(u => u.payload.unitType === 'TESTING' && u.payload.quantity.state === 'KNOWN' && u.payload.quantity.value === 1)).toHaveLength(1);
  expect(units(infra).find(u => u.payload.unitType === 'TESTING' && u.payload.quantity.state === 'KNOWN' && u.payload.quantity.value === 1)!.payload.source.kind).toBe('SOLUTION');
});
it('configuration aliases require reviewed owners and reject cycles', () => {
  const s = goldenSession(); const entry = s.configuration.entries['productivity.INTEGRATION']!;
  s.configuration.entries['productivity.INTEGRATION'] = { key: entry.key, revision: 2, basis: 'Alias', origin: 'ASSUMED', validation: 'VALIDATED', kind: 'ALIAS', owner: { kind: 'Assumption', id: 'ASM_01' }, field: 'value' };
  expect(resolveConfig(s, entry.key).value).toBeNull();
  s.configuration.entries[entry.key] = { ...s.configuration.entries[entry.key]!, kind: 'ALIAS', owner: { kind: 'CONFIGURATION', id: 'CFG_01', key: entry.key }, field: 'value' };
  expect(() => resolveConfig(s, entry.key)).toThrow(/cycle/);
});
it('assumption-only architecture flows to CLOUD and estimate without creating or covering requirements', () => {
  let s = goldenSession();
  s.idCounters.ASM = 1; s.assumptions.ASM_01 = { id: 'ASM_01', revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, reviewedAt: '2026-09-24T00:00:00Z', lastChangedBy: 'HUMAN', statement: 'Isolated validation environment', basis: 'Reviewed architecture assumption', sources: [], contextRefs: [], validation: 'PROVISIONAL' };
  const arch = Object.values(s.artifactSections).find(a => a.payload.kind === 'ArchitectureComponent')!;
  arch.grounding = [{ source: { kind: 'Assumption', id: 'ASM_01' }, reviewedRevision: 1, rationale: 'Assumed validation environment' }];
  s = reconcileUnits(s); for (const a of units(s)) { a.review = 'REVIEWED'; a.reviewedRevision = a.revision; a.reviewedAt = '2026-09-24T00:00:00Z'; }
  const requirements = structuredClone(s.requirements), coverage = scopeCoverage(s);
  const next = calc(s), cloud = units(next).find(u => u.payload.unitType === 'CLOUD')!, estimate = estimateView(next).items.find(i => i.payload.unitId === cloud.id)!;
  expect(cloud.grounding.map(g => g.source.kind)).toEqual(['Assumption']); expect(estimate.grounding).toEqual(cloud.grounding); expect(estimate.payload.effort).not.toBeNull();
  expect(next.requirements).toEqual(requirements); expect(scopeCoverage(next)).toEqual(coverage);
});
it.each(['rates.E', 'contingencyPercent', 'capacity.E', 'startDate', 'workingWeekdays', 'wait.implementation'])('missing %s leaves physical effort intact', key => {
  const s = goldenSession(); const previous = estimateView(calc(s)).summary!;
  delete s.configuration.entries[key]; const summary = estimateView(calc(s)).summary!;
  expect(summary.effort).toEqual(previous.effort);
  if (key === 'rates.E' || key === 'contingencyPercent') expect(summary.commercials.total).toBeNull();
  else if (key === 'startDate' || key === 'workingWeekdays') { expect(summary.workingDuration).toEqual(previous.workingDuration); expect(summary.finishDates).toBeNull(); }
  else expect(summary.workingDuration).toBeNull();
});
it('restoring currency-compatible confirmed rates makes ROM reproducible again', () => {
  const s = goldenSession(); setConfig(s, 'currency', { code: 'EUR', minorUnitDigits: 2 }, 'Reviewed', true);
  for (const role of ['A', 'E', 'D', 'C', 'Q']) setConfig(s, `rates.${role}`, { amount: 100000, currency: 'EUR', unit: 'minor-units/person-day' }, 'Supplied EUR rate, no FX', true);
  const summary = estimateView(calc(s)).summary!; expect(summary.commercials.total).toEqual({ low: 9775000, high: 16100000, unit: 'minor-units' });
});
it('phase reassignment changes schedule but never canonical labor or ROM ledgers', () => {
  const s = calc(); const initial = estimateView(s); const unit = unitByName(s, 'INT_B');
  unit.payload.workstreamId = Object.values(s.artifactSections).find(a => a.payload.kind === 'Workstream' && a.payload.phaseKey === 'ai')!.id;
  const after = estimateView(calc(s)); expect(after.items).toEqual(initial.items); expect(after.summary!.effort).toEqual(initial.summary!.effort); expect(after.summary!.commercials).toEqual(initial.summary!.commercials); expect(after.summary!.workingDuration).not.toEqual(initial.summary!.workingDuration);
});
it('unit review-only ineligibility retains the historical current item and blocks new use', () => {
  const s = calc(); const u = unitByName(s, 'INT_B'), item = estimateView(s).items.find(i => i.payload.unitId === u.id)!;
  u.review = 'PROPOSED'; delete u.reviewedRevision; delete u.reviewedAt;
  const next = calc(s); expect(estimateView(next).items.find(i => i.payload.unitId === u.id)).toEqual(item); expect(estimateView(next).summary!.effort).toBeNull();
});
it('per-unit referenced configuration is authoritative instead of silently resetting to its family', () => {
  const s = goldenSession(); const u = unitByName(s, 'INT_B');
  u.payload.baseEffortRef.node = { kind: 'CONFIGURATION', id: 'CFG_01', key: 'baseEffort.APPLICATION' };
  u.payload.productivityRef.node = { kind: 'CONFIGURATION', id: 'CFG_01', key: 'productivity.APPLICATION' };
  setConfig(s, 'productivity.APPLICATION', 2, 'Reviewed productivity override', true);
  const item = estimateView(calc(s)).items.find(i => i.payload.unitId === u.id)!;
  expect(item.payload.effort).toEqual({ low: 3, high: 4.5, unit: 'person-days' });
});

it('retiring every primary activity removes fixed discovery and handover in one reconciliation', () => {
  let s = goldenSession(); for (const a of units(s)) if (['APPLICATION', 'INTEGRATION', 'DATA', 'CLOUD', 'AI', 'SECURITY'].includes(a.payload.unitType)) a.lifecycle = 'RETIRED';
  s = reconcileUnits(s); for (const e of Object.values(s.configuration.entries)) e.validation = 'VALIDATED';
  for (const a of units(s)) { a.review = 'REVIEWED'; a.reviewedRevision = a.revision; a.reviewedAt = '2026-09-24T00:00:00Z'; }
  expect(estimateView(calc(s)).summary!.effort).toEqual({ low: 0, high: 0, unit: 'person-days' });
});
it('shared testing cannot newly consume an ineligible upstream band', () => {
  const s = goldenSession(), u = unitByName(s, 'INT_B');
  if (u.payload.source.kind === 'DOMAIN') s.artifactSections[u.payload.source.sectionId]!.review = 'PROPOSED';
  const next = calc(s); const testIds = units(next).filter(a => a.payload.unitType === 'TESTING').map(a => a.id);
  expect(estimateView(next).items.filter(i => testIds.includes(i.payload.unitId)).every(i => i.payload.effort === null)).toBe(true);
});
it('summary declares ownership and canonical membership consumed by scheduling', () => {
  const s = calc(); const summary = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimateSummary')!;
  const u = unitByName(s, 'INT_B');
  expect(summary.inputs.some(i => i.node.kind === 'ArtifactSection' && i.node.id === u.id && i.fields.includes('payload.workstreamId'))).toBe(true);
  expect(summary.inputs.some(i => i.node.kind === 'COLLECTION' && i.fields.includes('membership'))).toBe(true);
});
