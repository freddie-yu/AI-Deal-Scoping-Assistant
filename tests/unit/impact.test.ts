import { describe, expect, it } from 'vitest';
import { newSession } from '../../src/application/sessions.js';
import { addSection, goldenSession, unitByName } from '../helpers/estimation.js';
import { inputFor } from '../../src/application/deliverable-inputs.js';
import { calculateEstimate } from '../../src/estimation/engine.js';
import { setConfig } from '../../src/estimation/config.js';
import { addSource } from '../../src/ingestion/sources.js';
import { deriveDependencyIndex, nodeKey } from '../../src/traceability/dependencies.js';
import { applyImpact, diffSessions, resolveImpact } from '../../src/impact/index.js';
import type { ScopingSession } from '../../src/domain/index.js';

function fixture() {
  const s = newSession({ customerName: 'Impact', opportunityName: 'Selective' });
  s.requirements.FR_01 = { id: 'FR_01', displayId: 'FR_01', type: 'FR', description: 'Onboard', priority: 'MEDIUM', origin: 'AI_INFERRED', basis: 'Fixture', evidence: [], inclusion: 'INCLUDED', dependencyIds: [], assumptionIds: [], questionIds: [], revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, reviewedAt: '2026-09-27T00:00:00Z', lastChangedBy: 'HUMAN' };
  const arch = addSection(s, { kind: 'ArchitectureComponent', name: 'Host', cloud: 'AWS', catalogServiceKey: 'aws:ecs-fargate', purpose: 'Host', rationale: 'Requirement', tradeOffs: { state: 'KNOWN', value: 'Managed' }, securityControls: { state: 'KNOWN', value: 'Private' }, connections: [] }, 'Architecture');
  arch.grounding = [{ source: { kind: 'Requirement', id: 'FR_01' }, reviewedRevision: 1, rationale: 'Onboarding host' }];
  arch.inputs = [inputFor({ kind: 'Requirement', id: 'FR_01' }, s.requirements.FR_01, 1, ['exists', 'description', 'inclusion', 'lifecycle'])];
  const priority = addSection(s, { kind: 'Narrative', topic: 'COVERAGE', paragraphs: [], referencedIds: [], affectedRefs: [] }, 'Priorities');
  priority.inputs = [inputFor({ kind: 'Requirement', id: 'FR_01' }, s.requirements.FR_01, 1, ['priority'])];
  const downstream = addSection(s, { kind: 'Narrative', topic: 'DEPLOYMENT', paragraphs: [], referencedIds: [], affectedRefs: [] }, 'Deployment');
  downstream.inputs = [inputFor({ kind: 'ArtifactSection', id: arch.id }, arch, 1, ['payload'])];
  return { s, arch, priority, downstream };
}
const ids = (nodes: { kind: string; id?: string }[]) => nodes.filter(n => n.kind === 'ArtifactSection').map(n => n.id).sort();
function edited(s: ScopingSession, patch: object) { const next = structuredClone(s); Object.assign(next.requirements.FR_01!, patch); next.requirements.FR_01!.revision++; next.revision++; return next; }
function groundedGolden() {
  const s = goldenSession(); s.requirements.FR_01 = fixture().s.requirements.FR_01!;
  addSource(s, { title: 'Fixture', text: 'Onboard', inputKind: 'PASTED_TEXT' });
  const doc = Object.values(s.documents)[0]!;
  s.requirements.FR_01.evidence = [{ documentId: doc.id, sectionId: doc.sectionIds[0]!, start: 0, end: 7, excerpt: 'Onboard', relation: 'CONTEXT' }];
  // The arithmetic fixture intentionally omits source contracts. Supply them for
  // graph assertions: unresolved grounding must never prove "unaffected".
  for (const a of Object.values(s.artifactSections)) if (!a.inputs.length) a.inputs = [inputFor({ kind: 'Requirement', id: 'FR_01' }, s.requirements.FR_01, 1, ['description'])];
  return s;
}

describe('canonical dependency impact', () => {
  it('diffs actual fields and revisions, not revision increments or review metadata', () => {
    const { s } = fixture(); const next = edited(s, { priority: 'HIGH', review: 'DRAFT' });
    const diff = diffSessions(s, next);
    expect(diff.changes[0]).toMatchObject({ node: { kind: 'Requirement', id: 'FR_01' }, fields: ['priority'], oldRevision: 1, newRevision: 2 });
    expect(diff.changes[0]!.fieldChanges).toEqual([{ field: 'priority', before: { kind: 'TEXT', value: 'MEDIUM' }, after: { kind: 'TEXT', value: 'HIGH' } }]);
    expect(diffSessions(s, edited(s, { review: 'DRAFT' })).changes).toEqual([]);
  });
  it('priority watches preserve architecture byte-for-byte while refreshing priority consumer', () => {
    const { s, arch, priority, downstream } = fixture(); const next = edited(s, { priority: 'HIGH', review: 'DRAFT' });
    const result = applyImpact(s, next);
    expect(ids(result.direct)).toEqual([priority.id]); expect(ids(result.transitive)).toEqual([]);
    expect(result.unaffectedReviewed.map(n => n.id).sort()).toEqual([arch.id, downstream.id].sort());
    expect(next.artifactSections[arch.id]).toEqual(arch); expect(next.artifactSections[priority.id]!.freshness).toBe('STALE');
  });
  it('description has direct and potential multi-hop paths; only changed consumed values stale', () => {
    const { s, arch, downstream } = fixture(); const next = edited(s, { description: 'New workflow' }); const result = applyImpact(s, next);
    expect(ids(result.direct)).toEqual([arch.id]); expect(ids(result.transitive)).toEqual([downstream.id]);
    expect(result.reasons.find(r => r.node.kind === 'ArtifactSection' && r.node.id === downstream.id)?.path).toEqual([{ kind: 'Requirement', id: 'FR_01' }, { kind: 'ArtifactSection', id: arch.id }, { kind: 'ArtifactSection', id: downstream.id }]);
    expect(next.artifactSections[arch.id]!.freshness).toBe('STALE'); expect(next.artifactSections[downstream.id]).toEqual(downstream);
  });
  it.each([{ inclusion: 'EXCLUDED' }, { lifecycle: 'RETIRED' }])('invalidation consumes inclusion/lifecycle: %j', patch => {
    const { s, arch, downstream, priority } = fixture(); const result = applyImpact(s, edited(s, patch));
    expect(ids(result.direct)).toEqual([arch.id]); expect(ids(result.transitive)).toEqual([downstream.id]); expect(result.unaffectedReviewed.map(n => n.id)).toEqual([priority.id]);
  });
  it('traversal is deterministic, cycle-safe, deduplicated and retains reason edges', () => {
    const { s, arch, downstream } = fixture(); arch.inputs.push(inputFor({ kind: 'ArtifactSection', id: downstream.id }, downstream, 1, ['payload']));
    downstream.inputs.push(...arch.inputs.filter(i => i.node.kind === 'Requirement'));
    const next = edited(s, { description: 'Changed' }); const result = resolveImpact(next, diffSessions(s, next), deriveDependencyIndex(next), s);
    expect(ids([...result.direct, ...result.transitive])).toEqual([arch.id, downstream.id]);
    expect(result).toEqual(resolveImpact(next, diffSessions(s, next), deriveDependencyIndex(next), s));
    expect(result.reasons.every(r => !!r.edgeId && r.fields?.length)).toBe(true);
  });
  it('reports missing references and unknown consumption rather than false unaffected', () => {
    const { s, arch, priority } = fixture(); arch.inputs = []; priority.inputs[0]!.node = { kind: 'Requirement', id: 'FR_99' };
    const result = applyImpact(s, edited(s, { priority: 'HIGH' }));
    expect(ids(result.unknown)).toContain(arch.id); expect(result.unaffectedReviewed.map(n => n.id)).not.toContain(arch.id);
    expect(result.diagnostics.some(d => d.reason.includes('FR_99'))).toBe(true);
  });
  it('watches collections and resource versions independent of entity revisions', () => {
    const { s, arch } = fixture(); arch.inputs.push(inputFor({ kind: 'COLLECTION', name: 'requirements' }, { membership: ['FR_01'] }, 1, ['membership']));
    const next = structuredClone(s); next.requirements.FR_02 = { ...next.requirements.FR_01!, id: 'FR_02', displayId: 'FR_02' }; next.revision++;
    expect(ids(applyImpact(s, next).direct)).toContain(arch.id);
    const resource = { kind: 'AWS_CATALOG' as const, id: 'aws', version: 'old', hash: 'old' }; arch.inputs.push(inputFor(resource, resource, 1, ['version']));
    const changes = { id: 'resource', baseSessionRevision: 1, currentSessionRevision: 2, changes: [{ node: { ...resource, version: 'new' }, fields: ['version'], before: [{ kind: 'TEXT' as const, value: 'old' }], after: [{ kind: 'TEXT' as const, value: 'new' }] }], membershipChanges: [] };
    expect(ids(resolveImpact(s, changes).direct)).toContain(arch.id);
    expect(nodeKey(resource)).toBe(nodeKey({ ...resource, version: 'new' }));
  });
  it.each(['rates.E', 'contingencyPercent', 'currency'])('commercial %s changes exclude physical metrics and all design', key => {
    const s = calculateEstimate(goldenSession(), '2026-09-27T00:00:00Z'); const next = structuredClone(s);
    setConfig(next, key, key === 'rates.E' ? { amount: 90000, currency: 'USD', unit: 'minor-units/person-day' } : key === 'currency' ? { code: 'EUR', minorUnitDigits: 2 } : 20, 'Changed', true); next.revision++;
    const impact = applyImpact(s, next); const itemIds = Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimateItem' && (key !== 'rates.E' || a.payload.roleEffort.some(r => r.roleId === 'E'))).map(a => a.id).sort();
    expect(ids(impact.direct).filter(id => s.artifactSections[id!]!.payload.kind === 'EstimateItem')).toEqual(itemIds);
    for (const slice of impact.affectedSlices) { expect(slice.affected).not.toContain('effort'); expect(slice.affected).not.toContain('timeline'); }
    const arch = Object.values(s.artifactSections).find(a => a.payload.kind === 'ArchitectureComponent')!;
    expect(ids([...impact.direct, ...impact.transitive])).not.toContain(arch.id);
    expect(next.artifactSections[arch.id]).toEqual(arch);
  });
  it('INT_B change reports B, conditional testing and aggregates while retaining A/C', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z'); const next = structuredClone(s); const b = unitByName(s, 'INT_B');
    setConfig(next, `drivers.${b.id}.transformation`, true, 'Reconciliation', true); next.revision++;
    const impact = applyImpact(s, next); const affected = ids([...impact.direct, ...impact.transitive]);
    expect(affected).toContain(b.id);
    for (const name of ['INT_A', 'INT_C']) { const unit = unitByName(s, name); const item = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimateItem' && a.payload.unitId === unit.id)!; expect(affected).not.toContain(item.id); expect(impact.unaffectedReviewed.map(a => a.id)).toContain(item.id); }
    const testing = Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimationUnit' && a.payload.unitType === 'TESTING'); expect(testing.every(a => affected.includes(a.id))).toBe(true);
  });
  it('configuration aliases retain commercial-only slices from their consumed rate key', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z');
    const r = s.requirements.FR_01!;
    s.assumptions.ASM_01 = { id: 'ASM_01', statement: 'Reviewed engineering rate', basis: 'Rate assumption', sources: r.evidence, contextRefs: [], validation: 'PROVISIONAL', value: { kind: 'NUMBER', value: 80000, unit: 'minor-units/person-day' }, revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, reviewedAt: '2026-09-27T00:00:00Z', lastChangedBy: 'HUMAN' };
    // Graph contract can consume a structured owner field; calculation validation
    // separately enforces the rate object's shape and unit.
    s.configuration.entries['rates.E'] = { key: 'rates.E', kind: 'ALIAS', owner: { kind: 'Assumption', id: 'ASM_01' }, field: 'value', basis: 'Reviewed owner', origin: 'ASSUMED', validation: 'VALIDATED', revision: 2 };
    const next = structuredClone(s); next.assumptions.ASM_01!.value = { kind: 'NUMBER', value: 90000, unit: 'minor-units/person-day' }; next.revision++;
    const result = applyImpact(s, next);
    expect(result.affectedSlices.length).toBeGreaterThan(0);
    expect(result.affectedSlices.every(slice => !slice.affected.includes('effort') && !slice.affected.includes('timeline'))).toBe(true);
  });
  it('unrelated section membership preserves numerical results and shared testing byte-for-byte', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z'); const next = structuredClone(s);
    addSection(next, { kind: 'Narrative', topic: 'OVERVIEW', paragraphs: [], referencedIds: [], affectedRefs: [] }, 'Unrelated overview'); next.revision++;
    const result = applyImpact(s, next);
    expect(result.recalculationTargets).toEqual([]);
    for (const a of Object.values(s.artifactSections).filter(a => ['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(a.payload.kind))) {
      expect(next.artifactSections[a.id]).toEqual(a);
      expect(ids([...result.direct, ...result.transitive])).not.toContain(a.id);
    }
  });
  it.each(['APPLICATION', 'INTEGRATION'] as const)('unit membership watches exactly the %s inventory consumed', type => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z'); const next = structuredClone(s);
    const original = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimationUnit' && a.payload.unitType === type)!;
    addSection(next, original.payload, 'New inventory unit'); next.revision++;
    const result = applyImpact(s, next);
    const summary = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimateSummary')!;
    expect(ids(result.direct)).toContain(summary.id);
    for (const a of Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimationUnit' && a.payload.unitType === 'TESTING')) {
      expect(ids(result.direct).includes(a.id)).toBe(type === 'INTEGRATION');
    }
  });
  it('retains pending numerical recalculation when an unrelated generated section is accepted', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z');
    const section = addSection(s, { kind: 'Narrative', topic: 'OVERVIEW', paragraphs: [], referencedIds: [], affectedRefs: [] }, 'Generated overview');
    const changed = structuredClone(s); setConfig(changed, 'contingencyPercent', 20, 'Changed', true); changed.revision++;
    applyImpact(s, changed);
    const pending = Object.values(changed.artifactSections).filter(a => a.freshness === 'STALE' && ['EstimateItem', 'EstimateSummary'].includes(a.payload.kind)).map(a => a.id);
    expect(pending.length).toBeGreaterThan(0);
    const accepted = structuredClone(changed); accepted.artifactSections[section.id]!.payload = { kind: 'Narrative', topic: 'OVERVIEW', paragraphs: [{ text: 'Accepted summary', origin: 'ASSUMED', anchors: [], grounding: [] }], referencedIds: [], affectedRefs: [] }; accepted.revision++;
    const result = applyImpact(changed, accepted);
    expect(ids(result.recalculationTargets)).toEqual(expect.arrayContaining(pending));
  });
  it('cloud configuration invalidates only declared design consumers', () => {
    const { s, arch, priority } = fixture(); setConfig(s, 'cloud', 'AWS', 'Cloud constraint', true);
    arch.inputs.push(inputFor({ kind: 'CONFIGURATION', id: 'CFG_01', key: 'cloud' }, s.configuration.entries.cloud!, 1, ['value']));
    const next = structuredClone(s); setConfig(next, 'cloud', 'OTHER', 'Changed cloud constraint', true); next.revision++;
    const result = applyImpact(s, next);
    expect(ids(result.direct)).toEqual([arch.id]); expect(next.artifactSections[priority.id]).toEqual(priority);
  });
  it('question membership affects only estimates related to the added question', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z'); const next = structuredClone(s);
    const unit = unitByName(s, 'INT_B');
    next.questions.Q_01 = { id: 'Q_01', question: 'Unrelated question', criticality: 'HIGH', related: [], status: 'OPEN', revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, lastChangedBy: 'HUMAN' }; next.revision++;
    expect(applyImpact(s, next).recalculationTargets).toEqual([]);
    const linked = structuredClone(next); linked.questions.Q_01!.related = [{ kind: 'ArtifactSection', id: unit.id }]; linked.revision++;
    const result = applyImpact(next, linked);
    const expected = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimateItem' && a.payload.unitId === unit.id)!;
    expect(ids(result.direct)).toEqual([expected.id]);
  });
  it('removed unit inventory invalidates summary and shared testing even with dangling references', () => {
    const s = calculateEstimate(groundedGolden(), '2026-09-27T00:00:00Z'); const next = structuredClone(s);
    delete next.artifactSections[unitByName(s, 'INT_B').id]; next.revision++;
    const result = applyImpact(s, next);
    const expected = Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimateSummary' || a.payload.kind === 'EstimationUnit' && a.payload.unitType === 'TESTING');
    expect(ids(result.direct)).toEqual(expect.arrayContaining(expected.map(a => a.id)));
    expect(result.diagnostics.some(d => d.reason.includes('Dangling'))).toBe(true);
  });
  it('assumption value changes reach declared consumers without staling potential descendants', () => {
    const { s, arch, downstream, priority } = fixture();
    s.assumptions.ASM_01 = { id: 'ASM_01', statement: 'Volume', basis: 'Customer estimate', sources: [], contextRefs: [], validation: 'PROVISIONAL', value: { kind: 'NUMBER', value: 10, unit: 'requests/second' }, revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, lastChangedBy: 'HUMAN' };
    arch.inputs.push(inputFor({ kind: 'Assumption', id: 'ASM_01' }, s.assumptions.ASM_01, 1, ['value']));
    const next = structuredClone(s); next.assumptions.ASM_01!.value = { kind: 'NUMBER', value: 20, unit: 'requests/second' }; next.revision++;
    const result = applyImpact(s, next);
    expect(ids(result.direct)).toEqual([arch.id]); expect(ids(result.transitive)).toEqual([downstream.id]);
    expect(next.artifactSections[downstream.id]).toEqual(downstream); expect(next.artifactSections[priority.id]).toEqual(priority);
  });
});
