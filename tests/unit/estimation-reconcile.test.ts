import { expect, it } from 'vitest';
import { goldenSession, unitByName } from '../helpers/estimation.js';
import { reconcileUnits, addBoundary } from '../../src/estimation/reconcile.js';
import { ScopingSessionSchema } from '../../src/domain/index.js';
it('U1 reconciles the exact 24-unit golden inventory and reuses stable identities', () => {
  const s = goldenSession();
  expect(Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimationUnit' && a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 1)).toHaveLength(24);
  const u = unitByName(s, 'INT_B'); const again = reconcileUnits(s);
  expect(unitByName(again, 'INT_B').id).toBe(u.id);
  expect(ScopingSessionSchema.safeParse(again).success).toBe(true);
  if (u.payload.source.kind === 'DOMAIN') s.artifactSections[u.payload.source.sectionId]!.title = 'Renamed';
  expect(Object.values(reconcileUnits(s).artifactSections).find(a => a.id === u.id)?.payload.kind).toBe('EstimationUnit');
});
it('U1 keeps multiple migration packages on one domain and distinct environments', () => {
  const s = goldenSession(); const data = Object.values(s.artifactSections).find(a => a.payload.kind === 'DataDomain')!;
  const next = addBoundary(s, { unitType: 'DATA', name: 'Second', boundary: 'Different transformation boundary', scopeRefs: [data.id] });
  const packages = Object.values(next.artifactSections).filter(a => a.payload.kind === 'EstimationUnit' && a.payload.unitType === 'DATA');
  expect(packages).toHaveLength(2); expect(packages[0]!.id).not.toBe(packages[1]!.id);
});
it('U4 excludes target implementation and testing without recycling identity', () => {
  const s = goldenSession(); const u = unitByName(s, 'INT_B');
  if (u.payload.source.kind === 'DOMAIN') s.artifactSections[u.payload.source.sectionId]!.lifecycle = 'RETIRED';
  const next = reconcileUnits(s); const p = next.artifactSections[u.id]!.payload;
  expect(p.kind === 'EstimationUnit' && p.quantity).toEqual({ state: 'KNOWN', value: 0 });
  const test = Object.values(next.artifactSections).find(a => a.payload.kind === 'EstimationUnit' && a.payload.source.kind === 'TEST_TARGET' && a.payload.source.unitId === u.id)!;
  expect(test.payload.kind === 'EstimationUnit' && test.payload.quantity).toEqual({ state: 'KNOWN', value: 0 });
});
