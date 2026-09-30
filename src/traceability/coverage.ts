import type { ArtifactSection, ScopingSession } from '../domain/index.js';
import { groundingProblems } from '../validation/deliverables.js';
export function scopeCoverage(s: ScopingSession, eligibleSectionIds?: Set<string>) {
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE' && r.review === 'REVIEWED' && r.reviewedRevision === r.revision);
  const active = requirements.filter(r => r.inclusion === 'INCLUDED');
  const unsupported = Object.values(s.artifactSections).filter(a => a.payload.kind === 'Capability').flatMap(a => { const reasons = groundingProblems(s, a); return reasons.length ? [{ id: a.id, reasons }] : []; });
  const capabilities = Object.values(s.artifactSections).filter(a => a.payload.kind === 'Capability' && a.payload.inclusion === 'INCLUDED' && a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED' && a.reviewedRevision === a.revision && a.freshness === 'CURRENT' && !groundingProblems(s, a).length && (!eligibleSectionIds || eligibleSectionIds.has(a.id)));
  const rows = active.map(r => ({ id: r.id, type: r.type, priority: r.priority, capabilityIds: capabilities.filter(a => a.payload.kind === 'Capability' && a.payload.requirementIds.includes(r.id)).map(a => a.id) }));
  const covered = rows.filter(r => r.capabilityIds.length); const uncovered = rows.filter(r => !r.capabilityIds.length);
  return { eligible: active.length, covered: covered.length, percentage: active.length ? covered.length / active.length * 100 : null, rows, uncoveredIds: uncovered.map(r => r.id), excluded: requirements.filter(r => r.inclusion === 'EXCLUDED').map(r => ({ id: r.id, reason: r.exclusionReason! })), unsupported, highPriority: { eligible: rows.filter(r => r.priority === 'HIGH').length, covered: covered.filter(r => r.priority === 'HIGH').length }, functional: rows.filter(r => r.type === 'FR'), nonFunctional: rows.filter(r => ['NFR', 'SEC', 'DATA'].includes(r.type)) };
}
export function unsupportedAdditions(s: ScopingSession, sections: ArtifactSection[]) { return sections.flatMap(a => { const reasons = groundingProblems(s, a); return reasons.length ? [{ id: a.id, reasons }] : []; }); }
