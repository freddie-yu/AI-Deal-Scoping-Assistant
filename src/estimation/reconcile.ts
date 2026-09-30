import { allocateId } from '../domain/ids.js';
import type { ScopingSession, ArtifactSection, EstimationUnitPayload, UnitSource, UnitType, Grounding } from '../domain/index.js';
import { DRIVER_KEYS, PRIMARY, configRef, ruleRef, sectionRef, setConfig, resolveConfig, ref, hash } from './config.js';
export type UnitSection = ArtifactSection & { payload: EstimationUnitPayload };
const known = <T>(value: T) => ({ state: 'KNOWN' as const, value });
const unknown = (reason: string) => ({ state: 'UNRESOLVED' as const, reason, questionIds: [] });
export const units = (s: ScopingSession): UnitSection[] => Object.values(s.artifactSections).filter((a): a is UnitSection => a.payload.kind === 'EstimationUnit').sort((a, b) => a.id.localeCompare(b.id));
export function identity(type: UnitType, source: UnitSource) { return `${type}:${source.kind}:${source.kind === 'DOMAIN' ? source.sectionId : source.kind === 'SOLUTION' ? source.sessionId : source.kind === 'TEST_TARGET' ? source.unitId : source.key}`; }
export function estimateArtifact(s: ScopingSession) {
  const previous = Object.values(s.artifacts).find(a => a.kind === 'ESTIMATE'); if (previous) return previous;
  const id = allocateId(s, 'ART'); s.artifacts[id] = { id, revision: 1, kind: 'ESTIMATE', title: 'Deterministic estimate', sectionIds: [], templateVersion: 'demo-rom-v1' }; s.collectionCounters.artifacts++;
  return s.artifacts[id]!;
}
export function ownerFor(s: ScopingSession, type: UnitType, sources: string[] = []) {
  const phase: Record<UnitType, string> = { DISCOVERY: 'discovery', APPLICATION: 'implementation', INTEGRATION: 'implementation', DATA: 'implementation', CLOUD: 'foundation', AI: 'ai', SECURITY: 'foundation', TESTING: 'validation', HANDOVER: 'handover' };
  const ws = Object.values(s.artifactSections).filter(a => a.payload.kind === 'Workstream' && a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED');
  const preferred = ws.find(a => a.payload.kind === 'Workstream' && a.payload.phaseKey === phase[type]);
  const matches = ws.filter(a => a.payload.kind === 'Workstream' && sources.some(id => a.payload.kind === 'Workstream' && a.payload.advisory?.scopeRefs.includes(id)));
  const owner = preferred ?? (matches.length === 1 ? matches[0] : undefined);
  if (!owner) throw new Error(`Accepted workstream owner required for ${type}`);
  return owner.id;
}
function grounding(s: ScopingSession, sourceIds: string[]): Grounding[] {
  return [...new Map(sourceIds.flatMap(id => s.artifactSections[id]?.grounding ?? []).map(g => [`${g.source.kind}:${g.source.id}`, g])).values()];
}
function createUnit(s: ScopingSession, type: UnitType, source: UnitSource, sourceIds: string[], title: string): UnitSection {
  const key = identity(type, source); const existing = units(s).find(a => identity(a.payload.unitType, a.payload.source) === key);
  if (existing) return existing;
  const id = allocateId(s, 'AS'); const artifact = estimateArtifact(s);
  const flags = type === 'DISCOVERY' || type === 'HANDOVER' ? null : DRIVER_KEYS[type].map(flag => {
    const key = `drivers.${type === 'TESTING' ? 'solution' : id}.${flag}`;
    if (!(type === 'TESTING' && flag === 'anyHigh') && !s.configuration.entries[key]) setConfig(s, key, null, 'Driver fact requires human review; unknown is not false.', false);
    return { key: flag, inputs: [type === 'TESTING' && flag === 'anyHigh' ? ruleRef() : configRef(s, key)], ...(type === 'TESTING' && flag === 'anyHigh' ? { derivation: 'ANY_INCLUDED_HIGH' as const } : {}) };
  }) as Exclude<EstimationUnitPayload['drivers'], { policy: 'FIXED_LOW' }>['flags'] | null;
  const payload: EstimationUnitPayload = { kind: 'EstimationUnit', unitType: type, workstreamId: ownerFor(s, type, sourceIds), source, inclusion: unknown('Review applicability'), quantity: unknown('Review applicability'), drivers: flags ? { policy: 'THREE_FLAGS', flags } : { policy: 'FIXED_LOW' }, complexity: { score: null, band: unknown('Not yet calculated'), rationale: 'Deterministic driver calculation pending' }, baseEffortRef: configRef(s, `baseEffort.${type}`), productivityRef: configRef(s, `productivity.${type}`), roleAllocationRef: configRef(s, `roleAllocation.${type}`), multiplierConfig: { kind: 'CONFIGURATION', id: 'CFG_01', key: 'complexityMultipliers' }, ruleSetRef: ruleRef() };
  const a: UnitSection = { id, artifactId: artifact.id, sectionKey: key, title, payload, revision: 1, lifecycle: 'ACTIVE', review: 'PROPOSED', lastChangedBy: 'ENGINE', origin: 'ASSUMED', grounding: grounding(s, sourceIds), inputs: [], freshness: 'CURRENT', staleCauses: [] };
  s.artifactSections[id] = a; artifact.sectionIds.push(id); s.collectionCounters.artifactSections++;
  if (type === 'INTEGRATION') setConfig(s, `readiness.${id}`, null, 'External API readiness must be confirmed; a reviewed wait is separate.', false);
  return a;
}
function include(a: UnitSection, value: boolean | null, reason = 'Source is excluded or retired') {
  a.payload.inclusion = value === null ? unknown('Applicability remains unresolved') : known(value ? 'INCLUDED' : 'EXCLUDED');
  a.payload.quantity = value === null ? unknown('Applicability remains unresolved') : known(value ? 1 : 0);
  if (value === false) a.payload.exclusionReason = reason; else delete a.payload.exclusionReason;
}
export function reconcileUnits(input: ScopingSession): ScopingSession {
  const s = structuredClone(input); const before = new Map(units(s).map(a => [a.id, hash({ payload: a.payload, grounding: a.grounding })]));
  const oldPrimary = hash(units(s).filter(a => PRIMARY.includes(a.payload.unitType)).map(a => [a.id, a.payload.inclusion]));
  const sources = Object.values(s.artifactSections).filter(a => ['Capability', 'Integration', 'AIUseCase'].includes(a.payload.kind));
  for (const a of sources) {
    const type = a.payload.kind === 'Capability' ? 'APPLICATION' : a.payload.kind === 'Integration' ? 'INTEGRATION' : 'AI';
    const unit = createUnit(s, type, { kind: 'DOMAIN', sectionId: a.id }, [a.id], `${type}: ${a.title}`);
    include(unit, a.lifecycle === 'RETIRED' || a.payload.kind === 'Capability' && a.payload.inclusion === 'EXCLUDED' || a.applicability?.state === 'NOT_APPLICABLE' ? false : a.applicability?.state === 'UNRESOLVED' ? null : true);
    unit.grounding = grounding(s, [a.id]);
  }
  const scope = Object.values(s.artifactSections).filter(a => ['Capability', 'ArchitectureComponent', 'DataDomain', 'Integration', 'AIUseCase'].includes(a.payload.kind) && a.lifecycle === 'ACTIVE').map(a => a.id);
  if (scope.length) createUnit(s, 'SECURITY', { kind: 'SOLUTION', sessionId: s.id }, scope, 'Solution security and compliance');
  for (const u of units(s)) {
    const p = u.payload;
    if (p.source.kind === 'ENVIRONMENT' || p.source.kind === 'MIGRATION_PACKAGE') {
      if (p.source.scopeRefs.some(id => !s.artifactSections[id] || s.artifactSections[id]!.lifecycle === 'RETIRED')) include(u, false, 'Source boundary retired');
      else include(u, p.inclusion.state === 'KNOWN' ? p.inclusion.value === 'INCLUDED' : null);
      u.grounding = grounding(s, p.source.scopeRefs);
    }
    if (p.unitType === 'SECURITY') include(u, p.inclusion.state === 'KNOWN' ? p.inclusion.value === 'INCLUDED' : null);
  }
  for (const a of units(s)) if (a.lifecycle === 'RETIRED') include(a, false, 'Canonical activity retired; identity remains reserved');
  const primary = units(s).filter(a => PRIMARY.includes(a.payload.unitType));
  const nonempty = primary.some(a => a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 1);
  const complete = PRIMARY.every(t => resolveConfig<boolean>(s, `inventoryComplete.${t}`).value === true);
  const nonemptyState = nonempty ? true : complete && primary.every(a => a.payload.quantity.state === 'KNOWN') ? false : null;
  const targets = primary.filter(a => ['APPLICATION', 'INTEGRATION', 'DATA', 'AI'].includes(a.payload.unitType));
  for (const target of targets) {
    const a = createUnit(s, 'TESTING', { kind: 'TEST_TARGET', unitId: target.id }, [target.id], `Testing: ${target.title}`);
    include(a, target.payload.quantity.state === 'KNOWN' ? target.payload.quantity.value === 1 : null); a.grounding = target.grounding;
  }
  const includedTargets = targets.some(a => a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 1);
  const testingInventory = ['APPLICATION', 'INTEGRATION', 'DATA', 'AI'].every(t => resolveConfig<boolean>(s, `inventoryComplete.${t}`).value === true) && targets.every(a => a.payload.quantity.state === 'KNOWN');
  if (!includedTargets && nonempty || units(s).some(a => a.payload.unitType === 'TESTING' && a.payload.source.kind === 'SOLUTION')) {
    const fallback = createUnit(s, 'TESTING', { kind: 'SOLUTION', sessionId: s.id }, scope, 'Solution fallback testing');
    include(fallback, includedTargets ? false : testingInventory ? nonemptyState : null, 'Ordinary test targets are present');
  }
  if (scope.length || primary.length) for (const type of ['DISCOVERY', 'HANDOVER'] as const) include(createUnit(s, type, { kind: 'SOLUTION', sessionId: s.id }, scope, type), nonemptyState);
  for (const a of units(s)) {
    const p = a.payload;
    if (a.lifecycle === 'RETIRED') include(a, false, 'Canonical activity retired; identity remains reserved');
    const sourceIds = p.source.kind === 'DOMAIN' ? [p.source.sectionId] : p.source.kind === 'TEST_TARGET' ? [p.source.unitId] : p.source.kind === 'SOLUTION' ? scope : p.source.scopeRefs;
    a.inputs = [...sourceIds.map(id => sectionRef(s, id, ['exists', 'lifecycle', 'payload', 'grounding'])), p.baseEffortRef, p.productivityRef, p.roleAllocationRef, ruleRef()];
    if (p.source.kind === 'SOLUTION') a.inputs.push(ref({ kind: 'COLLECTION', name: 'artifactSections' }, scope.sort(), ['membership'], s.collectionCounters.artifactSections));
    if (before.has(a.id) && before.get(a.id) !== hash({ payload: p, grounding: a.grounding })) { a.revision++; a.review = 'PROPOSED'; delete a.reviewedAt; delete a.reviewedRevision; }
  }
  const newPrimary = hash(units(s).filter(a => PRIMARY.includes(a.payload.unitType)).map(a => [a.id, a.payload.inclusion]));
  if (before.size && newPrimary !== oldPrimary) for (const t of PRIMARY) { const e = s.configuration.entries[`inventoryComplete.${t}`]; if (e) e.validation = 'UNVALIDATED'; }
  return s;
}
export function addBoundary(input: ScopingSession, args: { unitType: 'DATA' | 'CLOUD'; name: string; boundary: string; scopeRefs: string[] }) {
  const s = structuredClone(input); const kind = args.unitType === 'DATA' ? 'DataDomain' : 'ArchitectureComponent';
  if (!args.name.trim() || !args.boundary.trim() || !args.scopeRefs.length || args.scopeRefs.some(id => s.artifactSections[id]?.payload.kind !== kind)) throw new Error(`Boundary requires ${kind} sources, name and scope`);
  // Allocate the opaque boundary key from the never-recycled section counter.
  const key = `boundary-${s.idCounters.AS + 1}`;
  const a = createUnit(s, args.unitType, { kind: args.unitType === 'DATA' ? 'MIGRATION_PACKAGE' : 'ENVIRONMENT', key, name: args.name, boundary: args.boundary, scopeRefs: args.scopeRefs }, args.scopeRefs, args.name);
  include(a, true);
  const e = s.configuration.entries[`inventoryComplete.${args.unitType}`]; if (e) e.validation = 'UNVALIDATED';
  return reconcileUnits(s);
}
export function reviewUnits(input: ScopingSession, now: string) {
  const s = structuredClone(input);
  for (const a of units(s)) { a.review = 'REVIEWED'; a.reviewedRevision = a.revision; a.reviewedAt = now; }
  return s;
}
