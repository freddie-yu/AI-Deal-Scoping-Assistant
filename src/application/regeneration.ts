import type { ArtifactSection, InputRef, ScopingSession } from '../domain/index.js';
import type { Phase2Operation, SectionCandidate } from '../domain/deliverables.js';
import type { BoundedGenerationContext } from '../ai/provider.js';
import { artifactEligible, fieldValue, inputFor, sectionInputs } from './deliverable-inputs.js';
import { sectionReferences } from '../validation/deliverables.js';
import { ValidationError } from './errors.js';

const stages: Record<string, Phase2Operation> = { PRD: 'prd-scope', FUNCTIONAL_SCOPE: 'prd-scope', ARCHITECTURE: 'architecture', DATA_STRATEGY: 'strategies', INTEGRATION_STRATEGY: 'strategies', AI_STRATEGY: 'strategies', DELIVERY_PLAN: 'delivery' };
const order: Phase2Operation[] = ['prd-scope', 'architecture', 'strategies', 'delivery'];
export function regenerationPlan(s: ScopingSession) {
  // The canonical stale queue is authoritative across successive edits. A prior
  // impact snapshot is an explanation, never permission to mutate fresh content.
  const stale = Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED' && a.freshness === 'STALE' && stages[s.artifacts[a.artifactId]?.kind ?? '']);
  const batches = order.map(operation => ({ operation, targets: stale.filter(a => stages[s.artifacts[a.artifactId]!.kind] === operation).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) }));
  const next = batches.find(b => b.targets.length);
  if (!next) throw new ValidationError('No stale generated sections require regeneration.', ['targets']);
  // A dependency must be accepted first. Same-stage chains are deliberately split
  // into separate runs so acceptance always re-traverses the current graph.
  next.targets = next.targets.filter(a => sectionReferences(a).every(ref => ref.id === a.id || !!s.artifactSections[ref.id] && artifactEligible(s, s.artifactSections[ref.id]!)));
  if (!next.targets.length) throw new ValidationError('Regeneration is blocked by an unreviewed or stale dependency. Review upstream inputs first.', ['inputs']);
  return next;
}
export function candidateFromSection(s: ScopingSession, a: ArtifactSection): SectionCandidate {
  const payload = structuredClone(a.payload);
  if (payload.kind === 'Narrative') payload.paragraphs = payload.paragraphs.map(p => ({ text: p.text, origin: p.origin, anchors: [], grounding: [] }));
  // Provider candidates cannot assign evidence, stamps, IDs or calculation fields.
  const cleanPayload = payload.kind === 'Narrative' ? { ...payload, paragraphs: payload.paragraphs.map(p => ({ text: p.text, origin: p.origin })) } : payload.kind === 'Workstream' ? (({ waitInput: _wait, ...rest }) => rest)(payload) : payload;
  return { key: a.sectionKey.slice(a.sectionKey.indexOf(':') + 1), artifactKind: s.artifacts[a.artifactId]!.kind, title: a.title, origin: 'AI_INFERRED', requirementIds: a.grounding.filter(g => g.source.kind === 'Requirement').map(g => g.source.id), assumptionIds: a.grounding.filter(g => g.source.kind === 'Assumption').map(g => g.source.id), rationale: a.grounding[0]?.rationale ?? 'Refresh the reviewed section from its declared inputs.', payload: cleanPayload, dependencies: a.dependencies ?? [], applicability: a.applicability ?? { state: 'KNOWN', value: 'Applicable to reviewed scope.' }, technologyChoices: a.technologyChoices ?? [] } as SectionCandidate;
}
export function inputRecord(s: ScopingSession, i: InputRef): object | undefined {
  const n = i.node;
  if (n.kind === 'Requirement') return s.requirements[n.id];
  if (n.kind === 'Assumption') return s.assumptions[n.id];
  if (n.kind === 'Question') return s.questions[n.id];
  if (n.kind === 'ArtifactSection') return s.artifactSections[n.id];
  if (n.kind === 'CONFIGURATION') return s.configuration.entries[n.key];
  if (n.kind === 'ScopingSession') return s;
  if (n.kind === 'COLLECTION') return { membership: Object.keys(s[n.name]).sort() };
  if ('version' in n) return { version: n.version };
  return undefined;
}
export function regenerationContext(s: ScopingSession, targets: ArtifactSection[]) {
  const inputs: InputRef[] = [];
  const context: BoundedGenerationContext = { seedId: s.seedId ?? '', targets: targets.map(a => {
    const basis = structuredClone(a);
    if (basis.payload.kind === 'Narrative' && basis.payload.topic === 'ASSUMPTIONS') basis.grounding = [...basis.grounding.filter(g => g.source.kind !== 'Assumption'), ...Object.values(s.assumptions).filter(r => r.lifecycle === 'ACTIVE').map(r => ({ source: { kind: 'Assumption' as const, id: r.id }, reviewedRevision: r.revision, rationale: 'List current reviewed assumptions and their explicit planning values.' }))];
    const manifest = sectionInputs(s, basis);
    // The old target is a declared template input; it is never a self-dependency
    // on the newly accepted canonical section.
    inputs.push(inputFor({ kind: 'ArtifactSection', id: a.id }, a, a.revision, ['payload', 'title', 'grounding', 'technologyChoices', 'lifecycle', 'sectionKey', 'dependencies', 'applicability']), ...manifest);
    return { id: a.id, candidate: candidateFromSection(s, basis), inputs: manifest.map(i => ({ node: i.node, values: Object.fromEntries(i.fields.map(field => [field, fieldValue(inputRecord(s, i), field)])) })) };
  }) };
  return { context, inputs: [...new Map(inputs.map(i => [JSON.stringify([i.node, i.fields]), i])).values()] };
}
