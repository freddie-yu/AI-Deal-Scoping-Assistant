import type { AnalysisProposal } from '../domain/analysis.js';
import type { ScopingSession, Requirement } from '../domain/index.js';
import { anchorForQuote, validateAnchor } from '../ingestion/sources.js';
import { ValidationError } from '../application/errors.js';

export const normalizeStatement = (s: string) => s.trim().replace(/\s+/g, ' ');
export function validateRequirementEvidence(session: ScopingSession, requirement: Pick<Requirement, 'origin' | 'description' | 'evidence' | 'basis'> & Pick<Partial<Requirement>, 'measures' | 'technologyConstraints'>, path = 'requirement') {
  if (!requirement.evidence.length) throw new ValidationError('Every requirement needs source evidence.', [`${path}.evidence`]);
  requirement.evidence.forEach((a, i) => validateAnchor(session, a, `${path}.evidence.${i}`));
  if (requirement.origin === 'CUSTOMER_STATED') {
    // Conservative direct support: a normalized exact quotation. Semantic paraphrases require explicit inference review.
    if (!requirement.evidence.some(a => a.relation === 'DIRECT' && normalizeStatement(a.excerpt) === normalizeStatement(requirement.description))) throw new ValidationError('Customer-stated content must match direct evidence. Supply an exact supported statement or reclassify as AI_INFERRED / ASSUMED with a basis.', [`${path}.description`, `${path}.origin`]);
    for (const [key, measure] of Object.entries(requirement.measures ?? {})) if (measure.state === 'KNOWN') {
      const supported = requirement.evidence.some(a => {
        const quote = normalizeStatement(a.excerpt).toLowerCase();
        const numbers = [...quote.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m => Number(m[0].replaceAll(',', '')));
        return a.relation === 'DIRECT' && numbers.includes(measure.value.value) && quote.includes(measure.value.unit.toLowerCase()) && (key !== 'concurrency' || /concurrent|concurrency/.test(quote));
      });
      if (!supported) throw new ValidationError('Customer-stated measures need the exact number and unit in direct evidence; user count cannot supply concurrency.', [`${path}.measures.${key}`]);
    }
    for (const constraint of requirement.technologyConstraints ?? []) if (constraint.values.some(value => !requirement.evidence.some(a => a.relation === 'DIRECT' && a.excerpt.toLowerCase().includes(value.toLowerCase())))) throw new ValidationError('Customer-stated technology values must occur in direct evidence.', [`${path}.technologyConstraints`]);
  } else if (!requirement.basis?.trim() || requirement.evidence.some(a => a.relation !== 'CONTEXT')) {
    throw new ValidationError('Inferred or assumed content requires a visible basis and CONTEXT evidence.', [`${path}.basis`, `${path}.evidence`]);
  }
}
export function validateAnalysis(session: ScopingSession, proposal: AnalysisProposal) {
  const checkRefs = (values: number[], size: number, path: string) => {
    if (values.some(v => v >= size) || new Set(values).size !== values.length) throw new ValidationError('Candidate references must identify supplied candidates exactly once.', [path]);
  };
  const anchors = (citations: AnalysisProposal['requirements'][number]['evidence'], path: string) => citations.map((c, i) => {
    if (!session.activeSourceIds.includes(c.documentId)) throw new ValidationError('Analysis may only cite the captured active source.', [path]);
    return anchorForQuote(session, c, `${path}.${i}`);
  });
  proposal.requirements.forEach((r, i) => {
    const path = `requirements.${i}`;
    const measures = r.measures ? Object.fromEntries(Object.entries(r.measures).filter(([, m]) => m.state === 'KNOWN')) as Requirement['measures'] : undefined;
    validateRequirementEvidence(session, { ...r, measures, evidence: anchors(r.evidence, `${path}.evidence`) }, path);
    checkRefs(r.dependencyRefs, proposal.requirements.length, `${path}.dependencyRefs`);
    if (r.dependencyRefs.includes(i)) throw new ValidationError('A requirement cannot depend on itself.', [`${path}.dependencyRefs`]);
    checkRefs(r.assumptionRefs, proposal.assumptions.length, `${path}.assumptionRefs`);
    checkRefs(r.questionRefs, proposal.questions.length, `${path}.questionRefs`);
    if (r.origin === 'ASSUMED' && !r.assumptionRefs.length) throw new ValidationError('Assumed requirements must identify a reviewable assumption.', [`${path}.assumptionRefs`]);
    for (const [key, measure] of Object.entries(r.measures ?? {})) if (measure.state === 'UNRESOLVED') {
      checkRefs(measure.questionRefs, proposal.questions.length, `${path}.measures.${key}`);
      if (measure.questionRefs.some(q => !r.questionRefs.includes(q))) throw new ValidationError('Unresolved measures must link their clarification questions.', [`${path}.questionRefs`]);
    }
  });
  proposal.assumptions.forEach((a, i) => { anchors(a.sources, `assumptions.${i}.sources`); checkRefs(a.requirementRefs, proposal.requirements.length, `assumptions.${i}.requirementRefs`); });
  proposal.questions.forEach((q, i) => { anchors(q.sources, `questions.${i}.sources`); checkRefs(q.requirementRefs, proposal.requirements.length, `questions.${i}.requirementRefs`); checkRefs(q.assumptionRefs, proposal.assumptions.length, `questions.${i}.assumptionRefs`); });
  proposal.context.forEach((c, i) => {
    anchors(c.sources, `context.${i}.sources`); checkRefs(c.requirementRefs, proposal.requirements.length, `context.${i}.requirementRefs`);
    c.facts.forEach((fact, j) => checkRefs(fact.requirementRefs, proposal.requirements.length, `context.${i}.facts.${j}`));
  });
}
