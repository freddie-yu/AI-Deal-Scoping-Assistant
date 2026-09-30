import type { ScopingSession } from '../domain/index.js';
import { units } from '../estimation/reconcile.js';
export function estimationCoverage(s: ScopingSession) {
  const all = units(s).filter(a => a.review === 'REVIEWED' && a.lifecycle === 'ACTIVE' && a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 1);
  return Object.values(s.artifactSections).filter(a => ['Capability', 'Integration', 'AIUseCase', 'ArchitectureComponent', 'DataDomain'].includes(a.payload.kind) && a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED' && !(a.payload.kind === 'Capability' && a.payload.inclusion === 'EXCLUDED')).map(a => {
    const unitIds = all.filter(u => { const p = u.payload.source; return p.kind === 'DOMAIN' ? p.sectionId === a.id : p.kind === 'ENVIRONMENT' || p.kind === 'MIGRATION_PACKAGE' ? p.scopeRefs.includes(a.id) : false; }).map(u => u.id);
    const estimateIds = Object.values(s.artifactSections).filter(e => e.payload.kind === 'EstimateItem' && unitIds.includes(e.payload.unitId)).map(e => e.id);
    return { sourceId: a.id, title: a.title, kind: a.payload.kind, unitIds, estimateIds, grounding: a.grounding, status: unitIds.length ? 'COVERED' as const : a.payload.kind === 'DataDomain' ? 'REVIEW_PACKAGE_APPLICABILITY' as const : 'MISSING_WORK' as const };
  });
}
