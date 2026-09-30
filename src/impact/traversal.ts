import type { ScopingSession, ChangeSet, ImpactResult, NodeRef, ArtifactSection } from '../domain/index.js';
import { consumedMembership, deriveDependencyIndex, nodeKey, type DependencyIndex } from '../traceability/dependencies.js';
import { hash } from '../estimation/config.js';
import { deriveComplexity } from '../estimation/engine.js';

export const watchesIntersect = (watch: string, field: string) => watch === field || watch.startsWith(`${field}.`) || field.startsWith(`${watch}.`);
const nref = (id: string): NodeRef => ({ kind: 'ArtifactSection', id });
const numerical = (a: ArtifactSection) => ['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(a.payload.kind);
const metrics = ['effort', 'roleEffort', 'timeline', 'baseCommercial', 'contingency', 'ROM', 'confidence'];
function slices(key: string | undefined, fields: string[]) {
  if (key?.startsWith('rates.') || key === 'currency') return ['baseCommercial', 'contingency', 'ROM', 'confidence'];
  if (key === 'contingencyPercent') return ['contingency', 'ROM', 'confidence'];
  if (['daysPerPersonWeek', 'effortRounding', 'calendarRounding', 'commercialRounding'].includes(key ?? '')) return ['presentation'];
  if (key?.startsWith('capacity.') || key?.startsWith('phaseMinimumDays.') || key?.startsWith('wait.') || ['startDate', 'workingWeekdays', 'holidays', 'deliveryDeadline'].includes(key ?? '')) return ['timeline', 'confidence'];
  if (fields.every(f => ['priority', 'validation', 'status', 'criticality', 'answer', 'question'].some(x => watchesIntersect(x, f)))) return ['confidence'];
  return metrics;
}
export function resolveImpact(s: ScopingSession, change: ChangeSet, index: DependencyIndex = deriveDependencyIndex(s), before?: ScopingSession): ImpactResult {
  const direct = new Map<string, NodeRef>(), transitive = new Map<string, NodeRef>(); const reasons: ImpactResult['reasons'] = []; const seen = new Set<string>();
  const affectedSlices = new Map<string, Set<string>>();
  let projected: ScopingSession | undefined;
  if (before && change.changes.some(c => c.node.kind === 'CONFIGURATION' || c.node.kind === 'Assumption')) {
    projected = structuredClone(s); try { deriveComplexity(projected); } catch { projected = undefined; }
  }
  const queue = [...change.changes.map(c => ({ node: c.node, fields: c.fields, path: [c.node], root: c, potential: false, configKey: c.node.kind === 'CONFIGURATION' ? c.node.key : undefined })), ...change.membershipChanges.map(m => ({ node: m.collection, fields: ['membership'], path: [m.collection], root: { node: m.collection, fields: ['membership'] }, potential: false, configKey: undefined as string | undefined }))];
  const changedKeys = new Set(queue.map(q => nodeKey(q.node)));
  // A filtered inventory can gain/lose members without an insertion/deletion,
  // e.g. linking an existing question or reactivating a source section.
  if (before) for (const c of change.changes) {
    const name = c.node.kind === 'Question' && c.fields.some(f => watchesIntersect('related', f)) || c.node.kind === 'Requirement' && c.fields.some(f => ['questionIds', 'assumptionIds'].some(w => watchesIntersect(w, f))) ? 'questions'
      : c.node.kind === 'ArtifactSection' && c.fields.some(f => ['lifecycle', 'payload.kind', 'payload.unitType'].some(w => watchesIntersect(w, f))) ? 'artifactSections' : undefined;
    if (name) queue.push({ node: { kind: 'COLLECTION', name }, fields: ['membership'], path: [c.node], root: c, potential: false, configKey: undefined });
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const q = queue[cursor]!; const visit = `${nodeKey(q.node)}:${q.fields.slice().sort().join(',')}:${nodeKey(q.root.node)}`;
    if (seen.has(visit)) continue; seen.add(visit);
    for (const edge of index.reverse.get(nodeKey(q.node)) ?? []) {
      const matched = q.fields.includes('*') ? edge.fields : edge.fields.filter(w => q.fields.some(f => watchesIntersect(w, f)));
      if (!matched.length) continue;
      if (q.node.kind === 'COLLECTION' && matched.includes('membership')) {
        const members = consumedMembership(s, edge);
        if (!members && q.root.node.kind !== 'COLLECTION') continue;
        if (members && hash(members) === (before ? hash(consumedMembership(before, edge)) : edge.input?.valueHash)) continue;
      }
      const downstreamKey = nodeKey(edge.downstream); if (changedKeys.has(downstreamKey)) continue;
      const isDirect = q.path.length === 1;
      if (isDirect) { direct.set(downstreamKey, edge.downstream); transitive.delete(downstreamKey); }
      else if (!direct.has(downstreamKey)) transitive.set(downstreamKey, edge.downstream);
      const path = [...q.path, edge.downstream];
      if (!reasons.some(r => nodeKey(r.node) === downstreamKey && (r.direct || !isDirect))) reasons.push({ node: edge.downstream, path, fields: matched, edgeId: edge.id, direct: isDirect, potential: !isDirect && q.potential, reason: `${nodeKey(q.node)}.${matched.join(', ')} → ${downstreamKey}: ${edge.basis}${q.potential ? ' (potential; compare accepted output)' : ''}` });
      const a = edge.downstream.kind === 'ArtifactSection' ? s.artifactSections[edge.downstream.id] : undefined;
      if (a && numerical(a)) {
        const changed = slices(q.configKey, q.root.fields); const set = affectedSlices.get(a.id) ?? new Set<string>(); changed.forEach(f => set.add(f)); affectedSlices.set(a.id, set);
      }
      let outputFields = ['*']; let potential = true;
      if (edge.downstream.kind === 'CONFIGURATION') { outputFields = ['value']; potential = q.potential; }
      if (a?.payload.kind === 'EstimationUnit' && projected && before) {
        const previous = before.artifactSections[a.id]?.payload; const next = projected.artifactSections[a.id]?.payload;
        // Shared testing consumes the resolved predicate, not every upstream band
        // revision. Once HIGH is already true another HIGH adds no testing work.
        if (previous?.kind === 'EstimationUnit' && next?.kind === 'EstimationUnit') {
          const bandChanged = hash(previous.complexity.band) !== hash(next.complexity.band);
          outputFields = bandChanged ? ['payload.complexity.band'] : [];
          potential = false;
          if (!bandChanged && a.payload.unitType === 'TESTING' && !isDirect) { transitive.delete(downstreamKey); affectedSlices.delete(a.id); const at = reasons.findIndex(r => nodeKey(r.node) === downstreamKey); if (at >= 0) reasons.splice(at, 1); continue; }
        }
      }
      // Cycles can be reported, but never keep expanding their paths.
      if (!q.path.some(n => nodeKey(n) === downstreamKey) && outputFields.length) queue.push({ ...q, node: edge.downstream, fields: outputFields, path, potential, configKey: edge.downstream.kind === 'CONFIGURATION' ? edge.downstream.key : q.configKey });
    }
  }
  const sort = (list: NodeRef[]) => list.sort((a, b) => nodeKey(a).localeCompare(nodeKey(b)));
  const affected = new Set([...direct.keys(), ...transitive.keys()]);
  // An unresolved declaration also makes its consumers unknown; it never grants
  // permission to call their dependency scopes unaffected.
  const unknown = new Map(index.unknown.map(n => [nodeKey(n), n])); const todo = [...unknown.values()];
  for (let i = 0; i < todo.length; i++) for (const edge of index.reverse.get(nodeKey(todo[i]!)) ?? []) if (!unknown.has(nodeKey(edge.downstream))) { unknown.set(nodeKey(edge.downstream), edge.downstream); todo.push(edge.downstream); }
  const all = Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE');
  const stale = all.filter(a => a.freshness === 'STALE' || direct.has(nodeKey(nref(a.id))) && a.payload.kind !== 'EstimationUnit');
  const targets = all.filter(a => affected.has(nodeKey(nref(a.id))));
  return { changeId: change.id, change, evaluatedRevision: s.revision, direct: sort([...direct.values()]), transitive: sort([...transitive.values()]), reasons: reasons.sort((a, b) => nodeKey(a.node).localeCompare(nodeKey(b.node))), affectedSectionIds: targets.map(a => a.id).sort(), affectedEstimateIds: targets.filter(numerical).map(a => a.id).sort(),
    unaffectedReviewed: all.filter(a => a.review === 'REVIEWED' && a.freshness === 'CURRENT' && !affected.has(nodeKey(nref(a.id))) && !unknown.has(nodeKey(nref(a.id)))).map(a => ({ id: a.id, hash: hash(a) })).sort((a, b) => a.id.localeCompare(b.id)),
    unknown: sort([...unknown.values()].filter(n => !affected.has(nodeKey(n)))), staleTargets: stale.map(a => nref(a.id)), regenerationTargets: stale.filter(a => !numerical(a) && s.artifacts[a.artifactId]?.kind !== 'ANALYSIS').map(a => nref(a.id)), recalculationTargets: targets.filter(numerical).map(a => nref(a.id)), refreshTargets: ['COVERAGE', 'QUALITY', ...(targets.some(a => a.payload.kind === 'ArchitectureComponent') ? ['DIAGRAM' as const] : [])],
    affectedSlices: [...affectedSlices].map(([id, set]) => ({ id, affected: [...set].sort(), unaffected: metrics.filter(m => !set.has(m)) })).sort((a, b) => a.id.localeCompare(b.id)), diagnostics: index.diagnostics };
}
