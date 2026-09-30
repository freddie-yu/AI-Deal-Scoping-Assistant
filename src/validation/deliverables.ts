import type { ArtifactSection, Grounding, ScopingSession } from '../domain/index.js';
import { ValidationError } from '../application/errors.js';
import { isServiceKey } from '../architecture/catalog.js';
import { compatibilityStatus } from '../architecture/compatibility.js';

export function groundingProblems(s: ScopingSession, section: ArtifactSection): string[] {
  const issues: string[] = [];
  const excluded = section.payload.kind === 'Capability' && section.payload.inclusion === 'EXCLUDED' || section.payload.kind === 'Narrative' && section.payload.topic === 'EXCLUSIONS';
  const valid = (g: Grounding) => {
    const r = g.source.kind === 'Requirement' ? s.requirements[g.source.id] : s.assumptions[g.source.id];
    return r && r.lifecycle === 'ACTIVE' && r.review === 'REVIEWED' && r.reviewedRevision === r.revision && ('inclusion' in r ? excluded || r.inclusion === 'INCLUDED' : r.validation !== 'UNVALIDATED');
  };
  for (const g of section.grounding) if (!valid(g)) issues.push(`Invalid reviewed grounding: ${g.source.id}`);
  if (!section.grounding.some(valid)) issues.push('No valid reviewed requirement or assumption grounding.');
  if (['Capability', 'Integration', 'AIUseCase'].includes(section.payload.kind) && !section.grounding.some(g => g.source.kind === 'Requirement' && valid(g))) issues.push('A reviewed requirement is mandatory; assumptions cannot substitute.');
  return issues;
}
export function sectionReferences(section: ArtifactSection): { id: string; kind?: ArtifactSection['payload']['kind']; selfAllowed?: boolean }[] {
  const p = section.payload; const refs: ReturnType<typeof sectionReferences> = (section.dependencies ?? []).map(id => ({ id }));
  const endpoint = (e: { kind: string; sectionId?: string }) => { if (e.kind === 'COMPONENT') refs.push({ id: e.sectionId!, kind: 'ArchitectureComponent', selfAllowed: true }); };
  if (p.kind === 'ArchitectureComponent') p.connections.forEach(f => { endpoint(f.from); endpoint(f.to); });
  if (p.kind === 'DataDomain') { p.sources.forEach(endpoint); p.flows.forEach(f => { endpoint(f.from); endpoint(f.to); }); refs.push(...p.storageRefs.map(id => ({ id, kind: 'ArchitectureComponent' as const }))); }
  if (p.kind === 'Integration') { p.endpoints.forEach(endpoint); refs.push(...p.dataDomainRefs.map(id => ({ id, kind: 'DataDomain' as const }))); }
  if (p.kind === 'Workstream') { refs.push(...p.predecessorRefs.map(id => ({ id, kind: 'Workstream' as const })), ...(p.advisory?.scopeRefs ?? []).map(id => ({ id }))); }
  if (p.kind === 'Narrative') refs.push(...[...p.referencedIds, ...p.affectedRefs].filter(r => r.kind === 'ArtifactSection').map(r => ({ id: r.id })));
  return refs;
}
export function technologyChecks(s: ScopingSession, sections: ArtifactSection[]) {
  const constraints = [...Object.values(s.requirements).filter(r => r.inclusion === 'INCLUDED'), ...Object.values(s.assumptions)].filter(r => r.lifecycle === 'ACTIVE' && r.review === 'REVIEWED').flatMap(r => (r.technologyConstraints ?? []).map(c => ({ sourceId: r.id, constraint: c })));
  const choices = sections.flatMap(a => (a.technologyChoices ?? []).map(c => ({ sectionId: a.id, choice: c })));
  return constraints.flatMap(({ sourceId, constraint }) => {
    const applicable = choices.filter(c => constraint.target === 'ALL' || c.choice.target === constraint.target);
    return (applicable.length ? applicable : [null]).map(c => ({ sourceId, constraintKey: constraint.key, strength: constraint.strength, sectionId: c?.sectionId ?? null, choiceKey: c?.choice.key ?? null, ...compatibilityStatus(constraint, c?.choice.technologyKey.state === 'KNOWN' ? c.choice.technologyKey.value : undefined) }));
  });
}
export function validateSections(s: ScopingSession, sections: ArtifactSection[], accepting = false) {
  const proposed = new Map(sections.map(a => [a.id, a]));
  const fail = (a: ArtifactSection, message: string) => { throw new ValidationError(`${a.title}: ${message}`, [`artifactSections.${a.id}`]); };
  for (const a of sections) {
    const problems = groundingProblems(s, a); if (problems.length) fail(a, problems.join(' '));
    const requirementIds = new Set(a.grounding.filter(g => g.source.kind === 'Requirement').map(g => g.source.id));
    const p = a.payload;
    const payloadReqs = p.kind === 'Capability' ? p.requirementIds : p.kind === 'AIUseCase' ? p.aiRequirementIds : [];
    if (payloadReqs.some(id => !requirementIds.has(id))) fail(a, 'Payload requirements must be included in reviewed grounding.');
    if (p.kind === 'Capability' && p.inclusion === 'EXCLUDED' && !p.exclusionReason) fail(a, 'Excluded capability needs a reason.');
    if (p.kind === 'Capability' && p.classification === 'OUT_OF_SCOPE' && p.inclusion !== 'EXCLUDED') fail(a, 'Out-of-scope capability must be excluded.');
    if (p.kind === 'ArchitectureComponent' && !isServiceKey(p.catalogServiceKey)) fail(a, 'Unknown AWS catalog service key.');
    if (p.kind === 'ArchitectureComponent' && !(a.technologyChoices ?? []).some(c => c.technologyKey.state === 'KNOWN' && c.technologyKey.value === p.catalogServiceKey)) fail(a, 'Architecture service must have a corresponding technology choice.');
    for (const ref of sectionReferences(a)) {
      const target = proposed.get(ref.id) ?? s.artifactSections[ref.id];
      if (accepting && !target) fail(a, `Accept dependency ${ref.id} first.`);
      if (!target || target.lifecycle !== 'ACTIVE' || target.freshness !== 'CURRENT' || ref.kind && target.payload.kind !== ref.kind) fail(a, `Invalid section reference ${ref.id}.`);
      if (accepting && !(ref.selfAllowed && ref.id === a.id) && s.artifactSections[ref.id]?.review !== 'REVIEWED') fail(a, `Accept dependency ${ref.id} first.`);
      if (accepting && target && !(ref.selfAllowed && ref.id === a.id) && groundingProblems(s, target).length) fail(a, `Dependency ${ref.id} no longer has eligible grounding.`);
      if (!accepting && !proposed.has(ref.id) && target!.review !== 'REVIEWED') fail(a, `Reference ${ref.id} is not accepted.`);
      if (p.kind === 'Workstream' && ref.kind === 'Workstream' && target?.payload.kind === 'Workstream' && target.payload.phaseOrder >= p.phaseOrder) fail(a, 'Delivery predecessor must have an earlier phase order; cycles are invalid.');
    }
    // Check external-system links, narrative links, and unresolved question IDs too.
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (record.kind === 'EXTERNAL_SYSTEM') {
        const refs = record.requirementIds as string[];
        if (!refs.length || refs.some(id => !requirementIds.has(id))) fail(a, 'External system lacks matching requirement grounding.');
        if ((record.sources as unknown[]).length) fail(a, 'Reference canonical requirement evidence instead of copying external source quotes.');
      }
      if (record.kind === 'Requirement' && !requirementIds.has(String(record.id))) fail(a, 'Narrative requirement reference must retain reviewed grounding.');
      if (record.kind === 'Assumption' && !a.grounding.some(g => g.source.kind === 'Assumption' && g.source.id === record.id)) fail(a, 'Narrative assumption reference must retain reviewed grounding.');
      if (record.kind === 'Question' && (!s.questions[String(record.id)] || s.questions[String(record.id)]?.lifecycle !== 'ACTIVE')) fail(a, 'Unknown narrative question reference.');
      if (record.state === 'UNRESOLVED' && (record.questionIds as string[]).some(id => !s.questions[id])) fail(a, 'Unknown clarification question reference.');
      Object.values(record).forEach(walk);
    }; walk(p); walk(a.applicability);
    if (p.kind === 'Integration') {
      const external = p.endpoints.filter(e => e.kind === 'EXTERNAL_SYSTEM');
      const components = p.endpoints.filter(e => e.kind === 'COMPONENT').map(e => proposed.get(e.sectionId) ?? s.artifactSections[e.sectionId]);
      if (!external.length || !components.length || !external.every(e => components.some(c => c?.payload.kind === 'ArchitectureComponent' && c.payload.connections.some(f => [f.from, f.to].some(v => v.kind === 'EXTERNAL_SYSTEM' && v.name === e.name && v.requirementIds.some(id => e.requirementIds.includes(id))))))) fail(a, 'Integration and architecture external endpoints/grounding must agree.');
    }
    if (accepting && technologyChecks(s, [a]).some(c => c.status === 'CONFLICT' && c.strength === 'MUST')) fail(a, 'Technology CONFLICT with a reviewed mandatory constraint.');
  }
}
