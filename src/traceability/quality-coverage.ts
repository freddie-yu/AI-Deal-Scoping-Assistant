import type { ArtifactSection, QualityGate, ScopingSession } from '../domain/index.js';
import { groundingProblems } from '../validation/deliverables.js';
import { scopeCoverage } from './coverage.js';

export function acceptedCurrent(s: ScopingSession, a: ArtifactSection): boolean {
  const payloadRequirements = a.payload.kind === 'Capability' ? a.payload.requirementIds : a.payload.kind === 'AIUseCase' ? a.payload.aiRequirementIds : [];
  return a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED' && a.reviewedRevision === a.revision && a.freshness === 'CURRENT' && !groundingProblems(s, a).length && payloadRequirements.every(id => a.grounding.some(g => g.source.kind === 'Requirement' && g.source.id === id));
}
/** Coverage is a projection of accepted canonical records, never pending runs. */
export function qualityCoverage(s: ScopingSession): QualityGate['coverage'] {
  const scope = scopeCoverage(s, new Set(Object.values(s.artifactSections).filter(a => acceptedCurrent(s, a)).map(a => a.id)));
  const eligibleRequirementIds = scope.rows.map(r => r.id).sort();
  const sections = Object.values(s.artifactSections).filter(a => acceptedCurrent(s, a));
  const stage = (records: ArtifactSection[]) => {
    const covered = new Set(records.flatMap(a => a.grounding.filter(g => g.source.kind === 'Requirement').map(g => g.source.id)));
    return { coveredIds: eligibleRequirementIds.filter(id => covered.has(id)), uncoveredIds: eligibleRequirementIds.filter(id => !covered.has(id)) };
  };
  const units = sections.filter(a => { const p = a.payload; return p.kind === 'EstimationUnit' && p.quantity.state === 'KNOWN' && p.quantity.value === 1 &&
    sections.some(w => w.id === p.workstreamId && w.payload.kind === 'Workstream'); });
  // Delivery requires an actual included source activity, not incidental solution-wide grounding.
  const delivered = units.flatMap(a => {
    if (a.payload.kind !== 'EstimationUnit') return [];
    const source = a.payload.source;
    const ids = source.kind === 'DOMAIN' ? [source.sectionId] : source.kind === 'ENVIRONMENT' || source.kind === 'MIGRATION_PACKAGE' ? source.scopeRefs : [];
    return sections.filter(record => ids.includes(record.id));
  });
  return {
    evaluatedRevision: s.revision, eligibleRequirementIds,
    scope: { coveredIds: scope.rows.filter(r => r.capabilityIds.length).map(r => r.id).sort(), uncoveredIds: [...scope.uncoveredIds].sort() },
    design: stage(sections.filter(a => ['ArchitectureComponent', 'Integration', 'DataDomain', 'AIUseCase'].includes(a.payload.kind))),
    delivery: stage(delivered), excluded: scope.excluded.sort((a, b) => a.id.localeCompare(b.id)), highPriority: scope.highPriority,
  };
}
export function coveragePercentage(coverage: QualityGate['coverage'], stage: 'scope' | 'design' | 'delivery'): number | null {
  return coverage.eligibleRequirementIds.length ? coverage[stage].coveredIds.length / coverage.eligibleRequirementIds.length * 100 : null;
}
