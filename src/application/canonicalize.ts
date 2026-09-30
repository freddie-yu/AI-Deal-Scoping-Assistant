import type { AnalysisProposal } from '../domain/analysis.js';
import type { ScopingSession, Requirement, GenerationRun } from '../domain/index.js';
import { allocateId } from '../domain/ids.js';
import { anchorForQuote } from '../ingestion/sources.js';
import { validateAnalysis } from '../validation/analysis.js';

export function canonicalizeAnalysis(session: ScopingSession, proposal: AnalysisProposal, metadata: { provider: string; mode: 'MOCK' | 'LIVE'; fixtureVariant?: string }): void {
  validateAnalysis(session, proposal);
  const runId = allocateId(session, 'RUN');
  const requirementIds = proposal.requirements.map(r => allocateId(session, r.type));
  const assumptionIds = proposal.assumptions.map(() => allocateId(session, 'ASM'));
  const questionIds = proposal.questions.map(() => allocateId(session, 'Q'));
  const stamp = { revision: 1, lifecycle: 'ACTIVE', review: 'DRAFT', lastChangedBy: 'MOCK', generationRunId: runId } as const;
  const anchors = (citations: AnalysisProposal['requirements'][number]['evidence']) => citations.map(c => anchorForQuote(session, c));
  // Explicit wholesale re-analysis retires old scope; identity is never inferred by prose matching.
  for (const record of [...Object.values(session.requirements), ...Object.values(session.assumptions), ...Object.values(session.questions)]) if (record.lifecycle === 'ACTIVE') { record.lifecycle = 'RETIRED'; record.revision++; record.review = 'DRAFT'; record.lastChangedBy = 'ENGINE'; }
  for (const id of session.context.analysisSectionIds) { const section = session.artifactSections[id]; if (section) { section.lifecycle = 'RETIRED'; section.revision++; section.review = 'PROPOSED'; } }
  proposal.requirements.forEach((r, i) => {
    const measures: Requirement['measures'] = r.measures ? Object.fromEntries(Object.entries(r.measures).map(([key, v]) => [key, v.state === 'UNRESOLVED' ? { state: v.state, reason: v.reason, questionIds: v.questionRefs.map(q => questionIds[q]!) } : v])) : undefined;
    const id = requirementIds[i]!;
    session.requirements[id] = { ...stamp, id, displayId: id, type: r.type, description: r.description, basis: r.basis, priority: r.priority, origin: r.origin, evidence: anchors(r.evidence), inclusion: 'INCLUDED', dependencyIds: r.dependencyRefs.map(n => requirementIds[n]!), assumptionIds: r.assumptionRefs.map(n => assumptionIds[n]!), questionIds: r.questionRefs.map(n => questionIds[n]!), ...(measures ? { measures } : {}), ...(r.technologyConstraints ? { technologyConstraints: r.technologyConstraints } : {}) };
  });
  proposal.assumptions.forEach((a, i) => { const id = assumptionIds[i]!; session.assumptions[id] = { ...stamp, id, statement: a.statement, basis: a.basis, sources: anchors(a.sources), contextRefs: a.requirementRefs.map(n => ({ kind: 'Requirement', id: requirementIds[n]! })), validation: a.validation, ...(a.value ? { value: a.value } : {}) }; });
  proposal.questions.forEach((q, i) => { const id = questionIds[i]!; session.questions[id] = { ...stamp, id, question: q.question, criticality: q.criticality, subject: q.subject, basis: q.basis, sources: anchors(q.sources), status: 'OPEN', related: [...q.requirementRefs.map(n => ({ kind: 'Requirement' as const, id: requirementIds[n]! })), ...q.assumptionRefs.map(n => ({ kind: 'Assumption' as const, id: assumptionIds[n]! }))] }; });
  const artifactId = allocateId(session, 'ART');
  const sectionIds = proposal.context.map((c, i) => {
    const id = allocateId(session, 'AS');
    session.artifactSections[id] = { ...stamp, review: 'PROPOSED', id, artifactId, sectionKey: `analysis-${i}`, title: c.topic, origin: c.origin, payload: { kind: 'Narrative', topic: c.topic, paragraphs: [{ text: c.text, origin: c.origin, anchors: anchors(c.sources), grounding: [] }], facts: c.facts.map(f => ({ subject: f.subject, value: f.value, requirementIds: f.requirementRefs.map(n => requirementIds[n]!) })), referencedIds: c.requirementRefs.map(n => ({ kind: 'Requirement', id: requirementIds[n]! })), affectedRefs: [] }, grounding: [], inputs: [], freshness: 'CURRENT', staleCauses: [] };
    return id;
  });
  session.artifacts[artifactId] = { id: artifactId, revision: 1, kind: 'ANALYSIS', title: 'Requirement analysis', sectionIds, templateVersion: 'scope-v1' };
  session.context.analysisSectionIds = sectionIds;
  const run: GenerationRun = { id: runId, operation: 'analyze', mode: 'MOCK', schemaVersion: '1', baseSessionRevision: session.revision, inputs: session.activeSourceIds.map(id => ({ node: { kind: 'SourceDocument', id }, fields: ['text'], consumedRevision: session.documents[id]!.version, valueHash: session.documents[id]!.hash })), allowedTargets: [], createWithin: [{ kind: 'COLLECTION', name: 'requirements' }, { kind: 'COLLECTION', name: 'assumptions' }, { kind: 'COLLECTION', name: 'questions' }, { kind: 'COLLECTION', name: 'artifactSections' }], state: 'SUCCEEDED', acceptance: 'ACCEPTED', proposals: [], provider: metadata.provider, fixtureVariant: metadata.fixtureVariant };
  session.generationRuns[runId] = run;
  for (const key of ['requirements', 'assumptions', 'questions', 'artifacts', 'artifactSections', 'generationRuns'] as const) session.collectionCounters[key]++;
}
