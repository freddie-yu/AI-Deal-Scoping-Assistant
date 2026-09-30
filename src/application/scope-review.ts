import type { ScopingSession } from '../domain/index.js';
import { sourceHash } from '../ingestion/sources.js';
import { validateRequirementEvidence } from '../validation/analysis.js';

export function scopeFingerprint(s: ScopingSession): string {
  const records = (items: Record<string, { id: string; revision: number; lifecycle: string }>) => Object.values(items).sort((a, b) => a.id.localeCompare(b.id));
  return sourceHash(JSON.stringify({ sources: [...s.activeSourceIds].sort().map(id => ({ id, hash: s.documents[id]?.hash })), requirements: records(s.requirements), assumptions: records(s.assumptions), questions: records(s.questions) }));
}
export function scopeReadiness(s: ScopingSession) {
  const blockers: string[] = []; const warnings: string[] = [];
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE');
  if (!requirements.some(r => r.inclusion === 'INCLUDED')) blockers.push('Analyze and include at least one requirement.');
  if (!s.activeSourceIds.length || s.activeSourceIds.some(id => !requirements.some(r => r.evidence.some(a => a.documentId === id)))) blockers.push('Analyze the current source version before scope approval.');
  for (const r of requirements) {
    if (r.review !== 'REVIEWED' || r.reviewedRevision !== r.revision) blockers.push(`${r.id}: review the current requirement revision.`);
    try { validateRequirementEvidence(s, r); } catch { blockers.push(`${r.id}: repair source provenance.`); }
    if (r.inclusion === 'INCLUDED') {
      for (const id of r.dependencyIds) if (s.requirements[id]?.lifecycle !== 'ACTIVE' || s.requirements[id]?.inclusion !== 'INCLUDED') blockers.push(`${r.id}: dependency ${id} is retired, missing or excluded.`);
      for (const id of r.assumptionIds) if (s.assumptions[id]?.lifecycle !== 'ACTIVE') blockers.push(`${r.id}: assumption ${id} is unavailable.`);
    }
  }
  for (const a of Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE')) {
    if (a.review !== 'REVIEWED' || a.reviewedRevision !== a.revision || a.validation === 'UNVALIDATED') blockers.push(`${a.id}: review and explicitly accept a provisional or confirmed assumption.`);
    if (a.validation !== 'CONFIRMED') warnings.push(`${a.id}: ${a.validation}; reviewed does not mean factually confirmed.`);
  }
  for (const q of Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE')) {
    if (q.review !== 'REVIEWED' || q.reviewedRevision !== q.revision) blockers.push(`${q.id}: review the question or its current answer.`);
    if (q.status === 'OPEN') warnings.push(`${q.id}: ${q.criticality} · OPEN · ${q.question}`);
  }
  return { blockers, warnings };
}
export function canGenerateDownstream(s: ScopingSession) {
  const ready = scopeReadiness(s); const approved = s.scopeReviewFingerprint === scopeFingerprint(s);
  return { eligible: ready.blockers.length === 0 && approved, reasons: [...ready.blockers, ...(!approved ? ['Approve the current reviewed scope before downstream generation.'] : [])] };
}
export function scopeStatus(s: ScopingSession) {
  const readiness = scopeReadiness(s); const eligibility = canGenerateDownstream(s);
  return { ...readiness, eligibility, status: eligibility.eligible ? 'APPROVED' as const : readiness.blockers.length ? 'NOT_READY' as const : 'READY_FOR_REVIEW' as const };
}
