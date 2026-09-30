import type { ScopingSession, NodeRef, InputRef, ArtifactSection, DependencyEdge } from '../domain/index.js';
import { hash } from '../estimation/config.js';
import { sectionReferences } from '../validation/deliverables.js';

// Resource identity deliberately excludes its version: a version replacement must
// find consumers of the previous version. No independently editable graph exists.
export function nodeKey(n: NodeRef): string {
  return n.kind === 'COLLECTION' ? `${n.kind}:${n.name}` : n.kind === 'CONFIGURATION' ? `${n.kind}:${n.key}` : `${n.kind}:${n.id}`;
}
export function resolveNode(s: ScopingSession, n: NodeRef): unknown {
  switch (n.kind) {
    case 'ScopingSession': return n.id === s.id ? s : undefined;
    case 'Requirement': return s.requirements[n.id];
    case 'Assumption': return s.assumptions[n.id];
    case 'Question': return s.questions[n.id];
    case 'ArtifactSection': return s.artifactSections[n.id];
    case 'Artifact': return s.artifacts[n.id];
    case 'SourceDocument': return s.documents[n.id];
    case 'SourceSection': return s.sourceSections[n.id];
    case 'GenerationRun': return s.generationRuns[n.id];
    case 'CONFIGURATION': return s.configuration.entries[n.key];
    case 'COLLECTION': return { membership: Object.keys(s[n.name]).sort() };
    default: return n;
  }
}
export type IndexedEdge = { id: string; upstream: NodeRef; downstream: NodeRef; fields: string[]; relation: DependencyEdge['kind']; basis: string; input?: InputRef };
/** Engine collection inputs consume canonical inventories, not every section in
 * the document. Keep these selectors aligned with reconcileUnits/deriveComplexity/calculateEstimate.
 * Undefined means an ordinary whole-collection declaration. */
export function consumedMembership(s: ScopingSession, edge: IndexedEdge): string[] | undefined {
  if (edge.upstream.kind !== 'COLLECTION' || edge.downstream.kind !== 'ArtifactSection') return undefined;
  const p = s.artifactSections[edge.downstream.id]?.payload;
  if (edge.upstream.name === 'questions' && p?.kind === 'EstimateItem') {
    const unit = s.artifactSections[p.unitId];
    if (unit?.payload.kind !== 'EstimationUnit') return undefined;
    const related = new Set([unit.id]);
    for (const g of unit.grounding) {
      related.add(g.source.id);
      if (g.source.kind === 'Requirement') {
        const r = s.requirements[g.source.id];
        for (const id of [...r?.assumptionIds ?? [], ...r?.questionIds ?? []]) related.add(id);
      }
    }
    return Object.values(s.questions).filter(q => related.has(q.id) || q.related.some(n => 'id' in n && related.has(n.id))).map(q => q.id).sort();
  }
  if (edge.upstream.name !== 'artifactSections') return undefined;
  const sharedTesting = p?.kind === 'EstimationUnit' && p.unitType === 'TESTING' && p.drivers.policy === 'THREE_FLAGS' && p.drivers.flags.some(f => f.derivation === 'ANY_INCLUDED_HIGH');
  if (p?.kind === 'EstimationUnit' && p.source.kind === 'SOLUTION' && !sharedTesting) return Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE' && ['Capability', 'ArchitectureComponent', 'DataDomain', 'Integration', 'AIUseCase'].includes(a.payload.kind)).map(a => a.id).sort();
  if (p?.kind !== 'EstimateSummary' && !sharedTesting) return undefined;
  return Object.values(s.artifactSections).filter(a => a.payload.kind === 'EstimationUnit' && (!sharedTesting || ['INTEGRATION', 'DATA', 'AI'].includes(a.payload.unitType))).map(a => a.id).sort();
}
export type DependencyIndex = { edges: IndexedEdge[]; reverse: Map<string, IndexedEdge[]>; unknown: NodeRef[]; diagnostics: { node: NodeRef; reason: string }[] };
const entity = (kind: 'ArtifactSection' | 'Requirement' | 'Assumption' | 'Question' | 'Artifact' | 'SourceDocument' | 'SourceSection', id: string): NodeRef => ({ kind, id });
export function deriveDependencyIndex(s: ScopingSession): DependencyIndex {
  const edges = new Map<string, IndexedEdge>(); const unknown = new Map<string, NodeRef>(); const diagnostics: DependencyIndex['diagnostics'] = [];
  const problem = (node: NodeRef, reason: string) => { if (!diagnostics.some(d => nodeKey(d.node) === nodeKey(node) && d.reason === reason)) diagnostics.push({ node, reason }); };
  const add = (upstream: NodeRef, downstream: NodeRef, fields: string[], basis: string, relation: IndexedEdge['relation'] = 'DEPENDS_ON', input?: InputRef) => {
    const watch = [...new Set(fields)].sort(); const id = hash([relation, nodeKey(upstream), nodeKey(downstream), watch]);
    edges.set(id, { id, upstream, downstream, fields: watch, basis, relation, ...(input ? { input } : {}) });
    // Missing config is an explicit computational gap, not a broken entity edge.
    if (resolveNode(s, upstream) === undefined && upstream.kind !== 'CONFIGURATION') { problem(downstream, `Dangling reference ${nodeKey(upstream)} (${basis}).`); unknown.set(nodeKey(downstream), downstream); }
  };
  const anchors = (refs: { documentId: string; sectionId: string }[], node: NodeRef) => refs.forEach(a => { add(entity('SourceDocument', a.documentId), node, ['exists', 'text', 'hash'], 'immutable source evidence'); add(entity('SourceSection', a.sectionId), node, ['exists', 'start', 'end'], 'source anchor'); });
  for (const r of Object.values(s.requirements)) {
    const n = entity('Requirement', r.id); anchors(r.evidence, n);
    r.dependencyIds.forEach(id => add(entity('Requirement', id), n, ['exists', 'description', 'measures', 'inclusion', 'lifecycle'], 'requirement dependency'));
    r.assumptionIds.forEach(id => add(entity('Assumption', id), n, ['exists', 'statement', 'basis', 'value', 'lifecycle'], 'assumption basis'));
  }
  for (const a of Object.values(s.assumptions)) { const n = entity('Assumption', a.id); anchors(a.sources, n); a.contextRefs.forEach(ref => add(ref, n, ['exists'], 'assumption context existence')); }
  for (const [key, e] of Object.entries(s.configuration.entries)) if (e.kind === 'ALIAS') add(e.owner, { kind: 'CONFIGURATION', id: 'CFG_01', key }, [e.field, 'exists', 'lifecycle'], 'single authoritative configuration owner');
  for (const a of Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE')) {
    const n = entity('ArtifactSection', a.id), p = a.payload;
    const analysis = s.artifacts[a.artifactId]?.kind === 'ANALYSIS';
    if (p.kind === 'Narrative') for (const paragraph of p.paragraphs) anchors(paragraph.anchors, n);
    for (const i of a.inputs) add(i.node, n, i.fields, 'declared consumed input', 'DEPENDS_ON', i);
    for (const g of a.grounding) {
      const inputs = a.inputs.filter(i => nodeKey(i.node) === nodeKey(g.source));
      if (inputs.length) add(g.source, n, [...new Set(inputs.flatMap(i => i.fields)), 'exists', 'lifecycle', ...(g.source.kind === 'Requirement' ? ['inclusion'] : [])], g.rationale, 'SUPPORTS');
      else if (!['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(p.kind)) { unknown.set(nodeKey(n), n); problem(n, `Grounding ${g.source.id} has no substantive consumption declaration.`); }
    }
    // Integrity and consumption are different. A diagram endpoint validates a
    // relationship but is not a reciprocal generation dependency.
    for (const r of sectionReferences(a)) {
      const target = s.artifactSections[r.id];
      if (!target || r.kind && target.payload.kind !== r.kind) { problem(n, `Dangling or incompatible section reference ${r.id}.`); unknown.set(nodeKey(n), n); }
    }
    const link = (id: string, fields: string[], basis: string) => { if (!a.inputs.some(i => i.node.kind === 'ArtifactSection' && i.node.id === id)) add(entity('ArtifactSection', id), n, fields, basis); };
    (a.dependencies ?? []).forEach(id => link(id, ['exists', 'payload', 'grounding', 'lifecycle'], 'explicit section dependency'));
    if (p.kind === 'Capability') p.requirementIds.forEach(id => { if (!s.requirements[id]) { problem(n, `Dangling requirement ${id}.`); unknown.set(nodeKey(n), n); } });
    if (p.kind === 'DataDomain') p.storageRefs.forEach(id => link(id, ['exists', 'payload.catalogServiceKey', 'lifecycle'], 'storage choice'));
    if (p.kind === 'Integration') p.dataDomainRefs.forEach(id => link(id, ['exists', 'payload', 'lifecycle'], 'integration data contract'));
    if (p.kind === 'Workstream') {
      p.predecessorRefs.forEach(id => link(id, ['exists', 'payload.phaseKey', 'payload.phaseOrder', 'payload.predecessorRefs'], 'scheduling predecessor'));
      (p.advisory?.scopeRefs ?? []).forEach(id => link(id, ['exists', 'lifecycle', 'payload.inclusion'], 'delivery representation'));
    }
    if (p.kind === 'EstimationUnit') {
      const source = p.source; const ids = source.kind === 'DOMAIN' ? [source.sectionId] : source.kind === 'TEST_TARGET' ? [source.unitId] : source.kind === 'SOLUTION' ? [] : source.scopeRefs;
      ids.forEach(id => link(id, ['exists', 'lifecycle', 'grounding', 'payload.inclusion'], 'canonical unit source'));
      if (s.artifactSections[p.workstreamId]?.payload.kind !== 'Workstream') problem(n, `Invalid workstream owner ${p.workstreamId}.`);
      for (const i of [p.baseEffortRef, p.productivityRef, p.roleAllocationRef, p.ruleSetRef, ...(p.drivers.policy === 'THREE_FLAGS' ? p.drivers.flags.flatMap(f => f.inputs) : [])]) add(i.node, n, i.fields, 'unit parameter/driver', 'DEPENDS_ON', i);
    }
    if (p.kind === 'EstimateItem') {
      link(p.unitId, ['exists', 'payload.quantity', 'payload.complexity.band'], 'exactly one canonical unit');
      if (s.artifactSections[p.unitId]?.payload.kind !== 'EstimationUnit') problem(n, `Estimate unit ${p.unitId} is missing or incompatible.`);
      for (const row of p.ledger) for (const i of row.inputs) add(i.node, n, i.fields, `calculation: ${row.ruleStep}`, 'DEPENDS_ON', i);
    }
    if (p.kind === 'EstimateSummary') p.estimateIds.forEach(id => link(id, ['exists', 'payload.effort', 'payload.commercials', 'payload.roleEffort', 'payload.confidenceByMetric'], 'aggregate member'));
    if (p.kind === 'Composite') p.sectionIds.forEach(id => link(id, ['exists', 'payload', 'lifecycle'], 'composite inclusion'));
    if (!analysis && !a.inputs.length && !a.grounding.length && !['EstimationUnit', 'EstimateItem', 'EstimateSummary', 'Workstream'].includes(p.kind)) { unknown.set(nodeKey(n), n); problem(n, 'Dependency scope is undeclared.'); }
  }
  for (const artifact of Object.values(s.artifacts)) for (const id of artifact.sectionIds) add(entity('ArtifactSection', id), entity('Artifact', artifact.id), ['exists', 'payload', 'lifecycle'], 'artifact composite inclusion');
  const sorted = [...edges.values()].sort((a, b) => `${nodeKey(a.upstream)}:${nodeKey(a.downstream)}:${a.id}`.localeCompare(`${nodeKey(b.upstream)}:${nodeKey(b.downstream)}:${b.id}`));
  const reverse = new Map<string, IndexedEdge[]>(); for (const edge of sorted) reverse.set(nodeKey(edge.upstream), [...reverse.get(nodeKey(edge.upstream)) ?? [], edge]);
  return { edges: sorted, reverse, unknown: [...unknown.values()].sort((a, b) => nodeKey(a).localeCompare(nodeKey(b))), diagnostics: diagnostics.sort((a, b) => `${nodeKey(a.node)}:${a.reason}`.localeCompare(`${nodeKey(b.node)}:${b.reason}`)) };
}
