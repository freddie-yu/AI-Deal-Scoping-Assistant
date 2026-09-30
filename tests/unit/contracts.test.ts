import { expect, it } from 'vitest';
import { ArtifactSectionSchema, ConfigurationSchema, EstimationUnitPayloadSchema, GenerationRunSchema, RequirementSchema, ScopingSessionSchema, SourceAnchorSchema, FieldPathSchema, EstimatePayloadSchema, type ScopingSession } from '../../src/domain/index.js';
import { newSession } from '../../src/application/sessions.js';
const stamp = { revision: 1, lifecycle: 'ACTIVE', review: 'DRAFT', lastChangedBy: 'HUMAN' } as const;
const input = { node: { kind: 'CONFIGURATION', id: 'CFG_01', key: 'baseEffort.APPLICATION' }, fields: ['value'], consumedRevision: 1, valueHash: 'fixture-hash' } as const;
function unit(source: object = { kind: 'DOMAIN', sectionId: 'AS_01' }) {
  return { kind: 'EstimationUnit', unitType: 'APPLICATION', workstreamId: 'AS_10', source,
    inclusion: { state: 'KNOWN', value: 'INCLUDED' }, quantity: { state: 'KNOWN', value: 1 },
    drivers: { policy: 'THREE_FLAGS', flags: ['branching', 'realtime', 'permissions'].map(key => ({ key, inputs: [input] })) },
    complexity: { score: null, band: { state: 'UNRESOLVED', reason: 'Not calculated', questionIds: [] }, rationale: 'Foundation contract only' },
    baseEffortRef: input, productivityRef: input, roleAllocationRef: input, multiplierConfig: input.node, ruleSetRef: input };
}
function section(id: string, payload: object) {
  return { ...stamp, review: 'PROPOSED', id, artifactId: 'ART_01', sectionKey: id, title: 'Schema fixture', origin: 'ASSUMED', payload, grounding: [], inputs: [], freshness: 'CURRENT', staleCauses: [] };
}
it('preserves exact source excerpts including leading and trailing whitespace', () => {
  const anchor = { documentId: 'DOC_01', sectionId: 'SRC_01', start: 0, end: 10, excerpt: '  hello\n  ', relation: 'DIRECT' };
  expect(SourceAnchorSchema.parse(anchor).excerpt).toBe('  hello\n  ');
});
it('accepts complete anchored requirements and rejects unsupported discriminants', () => {
  const value = { ...stamp, id: 'FR_01', displayId: 'FR_01', type: 'FR', description: 'Customer onboarding', priority: 'HIGH', origin: 'CUSTOMER_STATED', evidence: [{ documentId: 'DOC_01', sectionId: 'SRC_01', start: 0, end: 10, excerpt: 'Onboarding', relation: 'DIRECT' }], inclusion: 'INCLUDED', dependencyIds: [], assumptionIds: [], questionIds: [] };
  expect(RequirementSchema.parse(value)).toEqual(value);
  expect(RequirementSchema.safeParse({ ...value, evidence: [] }).success).toBe(false);
  expect(RequirementSchema.safeParse({ ...value, origin: 'GUESSED' }).success).toBe(false);
  expect(RequirementSchema.safeParse({ ...value, type: 'NFR' }).success).toBe(false);
});
it('validates atomic unit contracts without deriving complexity or effort', () => {
  expect(EstimationUnitPayloadSchema.parse(unit()).complexity.score).toBeNull();
  expect(EstimationUnitPayloadSchema.safeParse({ ...unit(), quantity: { state: 'KNOWN', value: 3 } }).success).toBe(false);
  expect(EstimationUnitPayloadSchema.safeParse(unit({ kind: 'SOLUTION', sessionId: '38cba7ea-5b5c-4d9f-90b1-24d285134f34' })).success).toBe(false);
  expect(EstimationUnitPayloadSchema.safeParse({ ...unit(), quantity: { state: 'NOT_APPLICABLE', reason: 'skip' } }).success).toBe(false);
});
it('keeps reviewed stale content representable without erasing historical review', () => {
  const value = section('AS_01', { kind: 'Narrative', topic: 'OVERVIEW', paragraphs: [], referencedIds: [], affectedRefs: [] });
  expect(ArtifactSectionSchema.parse({ ...value, review: 'REVIEWED', reviewedRevision: 1, reviewedAt: '2026-09-21T00:00:00Z', freshness: 'STALE' }).review).toBe('REVIEWED');
  expect(ArtifactSectionSchema.safeParse({ ...value, payload: { kind: 'Markdown', text: '# anything' } }).success).toBe(false);
});
it('rejects duplicate canonical units even across different workstreams', () => {
  const session: ScopingSession = newSession({ customerName: 'Schema fixture', opportunityName: 'Identity' });
  const workstream = { kind: 'Workstream', name: 'Delivery', phaseKey: 'phase1', phaseOrder: 1, predecessorRefs: [], milestones: [], risks: [], exclusions: [] };
  const capability = { kind: 'Capability', description: 'Onboarding', priority: 'HIGH', inclusion: 'INCLUDED', classification: 'REQUESTED', requirementIds: ['FR_01'] };
  const sections = { AS_01: section('AS_01', capability), AS_10: section('AS_10', workstream), AS_11: section('AS_11', workstream), AS_20: section('AS_20', unit()) };
  const valid = { ...session, artifactSections: sections };
  expect(ScopingSessionSchema.safeParse(valid).success).toBe(true);
  expect(ScopingSessionSchema.safeParse({ ...valid, artifactSections: { ...sections, AS_21: section('AS_21', { ...unit(), workstreamId: 'AS_11' }) } }).success).toBe(false);
});
it('retains separate raw baseline and multiplier entries and validates rate domains', () => {
  const entry = (key: string, value: unknown) => ({ key, revision: 1, basis: 'Explicit fixture', origin: 'ASSUMED', validation: 'UNVALIDATED', kind: 'VALUE', value: { state: 'KNOWN', value } });
  const config = { id: 'CFG_01', revision: 1, entries: { 'baseEffort.APPLICATION': entry('baseEffort.APPLICATION', { low: 4, high: 6, unit: 'person-days/unit' }), 'complexityMultipliers.MEDIUM': entry('complexityMultipliers.MEDIUM', 1.5), 'rates.E': entry('rates.E', { amount: 80000, currency: 'USD', unit: 'minor-units/person-day' }) } };
  expect(ConfigurationSchema.safeParse(config).success).toBe(true);
  expect(ConfigurationSchema.safeParse({ ...config, entries: { 'complexityMultipliers.LOW': entry('complexityMultipliers.LOW', 0) } }).success).toBe(false);
  expect(ConfigurationSchema.safeParse({ ...config, entries: { 'invented.key': entry('invented.key', 1) } }).success).toBe(false);
});
it('requires candidates only for create/update proposals', () => {
  const run = { id: 'RUN_01', operation: 'analyze', mode: 'MOCK', schemaVersion: '1', baseSessionRevision: 1, inputs: [], allowedTargets: [], createWithin: [], state: 'SUCCEEDED', acceptance: 'PENDING', proposals: [] };
  expect(GenerationRunSchema.safeParse(run).success).toBe(true);
  expect(GenerationRunSchema.safeParse({ ...run, proposals: [{ action: 'CREATE', target: { kind: 'Requirement', id: 'FR_01' } }] }).success).toBe(false);
  expect(GenerationRunSchema.safeParse({ ...run, proposals: [{ action: 'RETIRE', target: { kind: 'Requirement', id: 'FR_01' }, expectedRevision: 1 }] }).success).toBe(true);
});
it('rejects nonexistent field paths rather than accepting model-provided suffixes', () => {
  expect(FieldPathSchema.safeParse('description').success).toBe(true);
  expect(FieldPathSchema.safeParse('payload.complexity.band').success).toBe(true);
  expect(FieldPathSchema.safeParse('description.missing').success).toBe(false);
  expect(FieldPathSchema.safeParse('payload.thisFieldDoesNotExist').success).toBe(false);
  expect(FieldPathSchema.safeParse('reviewedRevision').success).toBe(false);
  for (const path of ['exclusionReason', 'confirmation', 'confirmation.note', 'text', 'title']) expect(FieldPathSchema.safeParse(path).success).toBe(true);
});
it('rejects incompatible effort units and fractional money ledger amounts', () => {
  const value = { unitId: 'AS_20', ruleSet: { id: 'demo-rom', version: '1', hash: 'hash' }, roleEffort: [], effort: { low: 1, high: 2, unit: 'person-days' }, timeline: null, commercials: { currency: 'USD', minorUnitDigits: 2, base: null, contingency: null, total: null }, resultStatus: 'PARTIAL', confidence: 'LOW', confidenceByMetric: { effort: 'MEDIUM', timeline: 'LOW', commercials: 'LOW' }, limitations: [], missingInputs: [], ledger: [], moneyLedger: [] };
  expect(EstimatePayloadSchema.safeParse(value).success).toBe(true);
  expect(EstimatePayloadSchema.safeParse({ ...value, effort: { low: 1, high: 2, unit: 'USD' } }).success).toBe(false);
  expect(EstimatePayloadSchema.safeParse({ ...value, moneyLedger: [{ unitId: 'AS_20', roleId: 'E', metric: 'BASE', rate: 1, currency: 'USD', cost: { low: 1.2, high: 2, unit: 'minor-units' } }] }).success).toBe(false);
});
