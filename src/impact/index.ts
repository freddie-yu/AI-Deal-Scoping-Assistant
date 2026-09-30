import type { ScopingSession, ImpactResult } from '../domain/index.js';
import { diffSessions } from './diff.js';
import { resolveImpact } from './traversal.js';
import { deriveDependencyIndex, nodeKey } from '../traceability/dependencies.js';
export { diffSessions } from './diff.js';
export { resolveImpact, watchesIntersect } from './traversal.js';
export type { ChangeSet, ImpactResult } from '../domain/index.js';

/** Domain command hook. Run after revision advancement, before atomic save.
 * Rebuilds on every acceptance, so structural proposals cannot reuse old paths.
 * Review-only changes re-evaluate the saved change against the new revision;
 * historical downstream stamps and input manifests remain untouched. */
export function applyImpact(before: ScopingSession, after: ScopingSession): ImpactResult {
  const diff = diffSessions(before, after);
  const substantive = diff.changes.length || diff.membershipChanges.length;
  const change = substantive ? diff : before.lastImpact?.change ?? diff;
  const impact = resolveImpact(after, change, deriveDependencyIndex(after), before);
  if (substantive) for (const n of impact.direct) if (n.kind === 'ArtifactSection') {
    const a = after.artifactSections[n.id]; if (!a || a.payload.kind === 'EstimationUnit') continue;
    // An engine result calculated within this same command is already current.
    if (a.lastChangedBy === 'ENGINE' && diff.changes.some(c => nodeKey(c.node) === nodeKey(n))) continue;
    a.freshness = 'STALE'; const reason = impact.reasons.find(r => nodeKey(r.node) === nodeKey(n));
    const cause = reason?.path[0]; if (cause && !a.staleCauses.some(n => nodeKey(n) === nodeKey(cause))) a.staleCauses.push(cause);
  }
  impact.staleTargets = Object.values(after.artifactSections).filter(a => a.lifecycle === 'ACTIVE' && a.freshness === 'STALE').map(a => ({ kind: 'ArtifactSection', id: a.id }));
  impact.regenerationTargets = impact.staleTargets.filter(n => n.kind === 'ArtifactSection' && !['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(after.artifactSections[n.id]!.payload.kind) && after.artifacts[after.artifactSections[n.id]!.artifactId]?.kind !== 'ANALYSIS');
  // A later section acceptance must not discard still-pending calculations from
  // an earlier edit. Freshness is authoritative across successive change sets.
  impact.recalculationTargets = [...new Map([...impact.recalculationTargets, ...impact.staleTargets.filter(n => n.kind === 'ArtifactSection' && ['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(after.artifactSections[n.id]!.payload.kind))].map(n => [nodeKey(n), n])).values()].sort((a, b) => nodeKey(a).localeCompare(nodeKey(b)));
  after.lastImpact = impact; delete after.gate; delete after.exportReceipt;
  return impact;
}
