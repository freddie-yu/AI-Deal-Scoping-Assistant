import type { ArtifactSection, InputRef, ScopingSession, NodeRef } from '../domain/index.js';
import { sourceHash } from '../ingestion/sources.js';
import { AWS_CATALOG, AWS_CATALOG_VERSION } from '../architecture/catalog.js';
import { COMPATIBILITY_RULES, COMPATIBILITY_VERSION } from '../architecture/compatibility.js';
import { groundingProblems, technologyChecks } from '../validation/deliverables.js';
import { CompatibilityResultSchema } from '../domain/operations.js';
import { sectionReferences } from '../validation/deliverables.js';
export function fieldValue(value: unknown, field: string): unknown {
  if (field === 'exists') return value !== undefined;
  return field.split('.').reduce<unknown>((v, key) => v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined, value) ?? null;
}
export function inputFor(node: NodeRef, value: object, revision: number, fields: string[]): InputRef {
  return { node, fields, consumedRevision: revision, valueHash: sourceHash(JSON.stringify(fields.map(f => [f, fieldValue(value, f)]))) };
}
const requirementFields = ['exists', 'description', 'type', 'priority', 'origin', 'evidence', 'inclusion', 'exclusionReason', 'lifecycle', 'dependencyIds', 'assumptionIds', 'questionIds', 'measures', 'technologyConstraints'];
const assumptionFields = ['exists', 'statement', 'basis', 'sources', 'contextRefs', 'validation', 'value', 'technologyConstraints', 'lifecycle'];
export function scopeInputs(s: ScopingSession): InputRef[] {
  return [
    inputFor({ kind: 'ScopingSession', id: s.id }, s, s.revision, ['context', 'activeSourceIds']),
    ...Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE').map(r => inputFor({ kind: 'Requirement', id: r.id }, r, r.revision, requirementFields)),
    ...Object.values(s.assumptions).filter(r => r.lifecycle === 'ACTIVE').map(r => inputFor({ kind: 'Assumption', id: r.id }, r, r.revision, assumptionFields)),
    ...Object.values(s.questions).filter(r => r.lifecycle === 'ACTIVE').map(r => inputFor({ kind: 'Question', id: r.id }, r, r.revision, ['question', 'status', 'answer', 'related', 'criticality'])),
    ...s.activeSourceIds.map(id => inputFor({ kind: 'SourceDocument', id }, s.documents[id]!, s.documents[id]!.version, ['text', 'hash', 'sectionIds'])),
    ...(['requirements', 'assumptions', 'questions'] as const).map(name => inputFor({ kind: 'COLLECTION', name }, { membership: Object.keys(s[name]).sort() }, s.collectionCounters[name], ['membership'])),
  ];
}
export function artifactInput(a: ArtifactSection) { return inputFor({ kind: 'ArtifactSection', id: a.id }, a, a.revision, ['exists', 'payload', 'grounding', 'technologyChoices', 'lifecycle']); }
// Manifests describe this section's substantive basis, not the whole generation
// batch. Review metadata is deliberately excluded from content fingerprints.
export function sectionInputs(s: ScopingSession, a: ArtifactSection): InputRef[] {
  const p = a.payload;
  const inputs: InputRef[] = [];
  for (const g of a.grounding) {
    const r = g.source.kind === 'Requirement' ? s.requirements[g.source.id] : s.assumptions[g.source.id];
    if (!r) continue;
    const fields = g.source.kind === 'Requirement' ? ['exists', 'description', 'type', 'origin', 'evidence', 'inclusion', 'lifecycle', 'assumptionIds'] : ['exists', 'statement', 'basis', 'sources', 'contextRefs', 'validation', 'value', 'lifecycle'];
    if (g.source.kind === 'Requirement') {
      if (p.kind === 'Capability') fields.push('priority', 'dependencyIds', 'exclusionReason');
      if (p.kind === 'Narrative' && p.topic === 'DEPENDENCIES') fields.push('dependencyIds');
      if (p.kind === 'Narrative' && ['NON_FUNCTIONAL_REQUIREMENTS', 'SCALABILITY', 'ENVIRONMENTS', 'AVAILABILITY'].includes(p.topic)) fields.push('measures');
      if ((a.technologyChoices ?? []).length) fields.push('technologyConstraints');
    }
    inputs.push(inputFor(g.source, r, r.revision, fields));
  }
  const questionIds = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.state === 'UNRESOLVED' && Array.isArray(record.questionIds)) for (const id of record.questionIds) questionIds.add(String(id));
    Object.values(record).forEach(walk);
  };
  walk(p); walk(a.applicability);
  if (p.kind === 'Narrative' && p.topic === 'QUESTIONS') Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE').forEach(q => questionIds.add(q.id));
  for (const id of questionIds) { const q = s.questions[id]; if (q) inputs.push(inputFor({ kind: 'Question', id }, q, q.revision, ['exists', 'question', 'status', 'answer', 'related', 'criticality', 'lifecycle'])); }
  if (p.kind === 'Narrative' && p.topic === 'OVERVIEW') inputs.push(inputFor({ kind: 'ScopingSession', id: s.id }, s, s.revision, ['context.opportunityName']));
  if (p.kind === 'Narrative' && a.sectionKey.startsWith('PRD:')) {
    const name = p.topic === 'ASSUMPTIONS' ? 'assumptions' : p.topic === 'QUESTIONS' ? 'questions' : 'requirements';
    inputs.push(inputFor({ kind: 'COLLECTION', name }, { membership: Object.keys(s[name]).sort() }, s.collectionCounters[name], ['membership']));
  }
  for (const id of new Set(sectionReferences(a).map(r => r.id))) if (id !== a.id && s.artifactSections[id]) inputs.push(artifactInput(s.artifactSections[id]!));
  if ((a.technologyChoices ?? []).length) inputs.push(...resourceInputs());
  else inputs.push(templateInput());
  for (const key of ['cloud', ...(a.sectionKey.startsWith('AI_STRATEGY:') ? ['aiProviderPreference'] : [])]) {
    const entry = s.configuration.entries[key];
    if (entry && ['ARCHITECTURE', 'DATA_STRATEGY', 'INTEGRATION_STRATEGY', 'AI_STRATEGY'].includes(s.artifacts[a.artifactId]?.kind ?? '')) inputs.push(inputFor({ kind: 'CONFIGURATION', id: s.configuration.id, key }, entry, entry.revision, entry.kind === 'VALUE' ? ['exists', 'value', 'basis'] : ['exists', 'owner', 'field', 'basis']));
  }
  return inputs;
}
export function templateInput(): InputRef { return inputFor({ kind: 'DOCUMENT_TEMPLATE', id: 'deliverables', version: 'phase2-1', hash: sourceHash('phase2-1') }, { version: 'phase2-1' }, 1, ['version']); }
export function resourceInputs(): InputRef[] {
  return [inputFor({ kind: 'AWS_CATALOG', id: 'aws', version: AWS_CATALOG_VERSION, hash: sourceHash(JSON.stringify(AWS_CATALOG)) }, { version: AWS_CATALOG_VERSION }, 1, ['version']), inputFor({ kind: 'TECH_COMPATIBILITY', id: 'seed-compatibility', version: COMPATIBILITY_VERSION, hash: sourceHash(JSON.stringify(COMPATIBILITY_RULES)) }, { version: COMPATIBILITY_VERSION }, 1, ['version']), templateInput()];
}
export function inputsCurrent(s: ScopingSession, inputs: InputRef[]) {
  return inputs.every(i => {
    const n = i.node; let record: object | undefined;
    if (n.kind === 'ScopingSession') record = s;
    if (n.kind === 'Requirement') record = s.requirements[n.id];
    if (n.kind === 'Assumption') record = s.assumptions[n.id];
    if (n.kind === 'Question') record = s.questions[n.id];
    if (n.kind === 'SourceDocument') record = s.documents[n.id];
    if (n.kind === 'ArtifactSection') record = s.artifactSections[n.id];
    if (n.kind === 'CONFIGURATION') record = s.configuration.entries[n.key];
    if (n.kind === 'COLLECTION') record = { membership: Object.keys(s[n.name]).sort() };
    if (n.kind === 'AWS_CATALOG' || n.kind === 'TECH_COMPATIBILITY' || n.kind === 'DOCUMENT_TEMPLATE') return resourceInputs().some(r => JSON.stringify(r.node) === JSON.stringify(n));
    return record !== undefined && inputFor(n, record, i.consumedRevision, i.fields).valueHash === i.valueHash;
  });
}
// Validation is a new-use guard, not a substantive value included in freshness hashes.
export function configurationInputsEligible(s: ScopingSession, inputs: InputRef[]): boolean {
  return inputs.every(i => i.node.kind !== 'CONFIGURATION' || s.configuration.entries[i.node.key]?.validation === 'VALIDATED');
}
// Read-only upstream eligibility, not reverse change-impact traversal: this neither
// marks sections stale nor computes affected outputs. Cyclic consumed inputs cannot
// establish an eligible basis for a new generation/acceptance operation.
export function artifactEligible(s: ScopingSession, a: ArtifactSection, visiting = new Set<string>()): boolean {
  if (visiting.has(a.id) || a.review !== 'REVIEWED' || a.reviewedRevision !== a.revision || a.lifecycle !== 'ACTIVE' || a.freshness !== 'CURRENT' || groundingProblems(s, a).length || !inputsCurrent(s, a.inputs) || !configurationInputsEligible(s, a.inputs)) return false;
  const path = new Set(visiting).add(a.id);
  return a.inputs.every(i => i.node.kind !== 'ArtifactSection' || !!s.artifactSections[i.node.id] && artifactEligible(s, s.artifactSections[i.node.id]!, path));
}
export function compatibilityResults(s: ScopingSession, sections: ArtifactSection[]) {
  const catalog = resourceInputs().find(i => i.node.kind === 'TECH_COMPATIBILITY')!;
  return technologyChecks(s, sections).map(result => {
    const requirement = s.requirements[result.sourceId]; const record = requirement ?? s.assumptions[result.sourceId]!;
    const section = sections.find(a => a.id === result.sectionId);
    const references = CompatibilityResultSchema.parse({ constraint: inputFor({ kind: requirement ? 'Requirement' : 'Assumption', id: record.id }, record, record.revision, ['technologyConstraints']), choice: section ? inputFor({ kind: 'ArtifactSection', id: section.id }, section, section.revision, ['technologyChoices']) : null, catalog, status: result.status, ruleIds: result.ruleIds, reason: result.reason });
    return { ...result, ...references };
  });
}
