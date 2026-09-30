import { ScopingSessionSchema, QualityGateSchema, type ArtifactSection, type NodeRef, type QualityGate, type ScopingSession, type ValidationIssue } from '../domain/index.js';
import { PRD_TOPICS } from '../domain/deliverables.js';
import { CompatibilityResultSchema } from '../domain/operations.js';
import { canGenerateDownstream } from '../application/scope-review.js';
import { compatibilityResults } from '../application/deliverable-inputs.js';
import { validateScopeIntegrity } from '../validation/scope-integrity.js';
import { groundingProblems, validateSections } from '../validation/deliverables.js';
import { buildDiagram } from '../architecture/diagram.js';
import { calculateEstimate } from '../estimation/engine.js';
import { canonicalJSON, hash } from '../estimation/config.js';
import { acceptedCurrent, qualityCoverage } from '../traceability/quality-coverage.js';
import { deriveDependencyIndex } from '../traceability/dependencies.js';
export type { QualityGate, ValidationIssue } from '../domain/index.js';
export const QUALITY_RULE_VERSION = 'phase4-quality-v1';
const node = (id: string): NodeRef => ({ kind: 'ArtifactSection', id });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function gateCurrent(s: ScopingSession): boolean {
  return !!s.gate && s.gate.evaluatedRevision === s.revision && s.gate.ruleVersion === QUALITY_RULE_VERSION;
}

/** Pure inspection. No AI calls, canonical mutations or alternative estimation formulas. */
export function evaluateQuality(s: ScopingSession, options: { diagramRendered?: boolean } = {}): QualityGate {
  const findings = new Map<string, ValidationIssue>();
  const add = (ruleId: string, type: ValidationIssue['type'], severity: ValidationIssue['severity'], related: NodeRef[], message: string, paths: string[] = [], discriminator = '') => {
    const refs = [...related].sort((a, b) => canonicalJSON(a).localeCompare(canonicalJSON(b)));
    const key = `${ruleId}:${hash([refs, [...paths].sort(), discriminator]).slice(0, 20)}`;
    findings.set(key, { key, ruleId, ruleVersion: QUALITY_RULE_VERSION, type, severity, status: 'OPEN', related: refs, paths, message, blocking: severity === 'ERROR', evaluatedRevision: s.revision });
  };
  const sessionNode: NodeRef = { kind: 'ScopingSession', id: s.id };
  const coverage = qualityCoverage(s);
  const schema = ScopingSessionSchema.safeParse(s);
  if (!schema.success) for (const issue of schema.error.issues) add('canonical-schema', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], `${issue.path.join('.')}: ${issue.message}`, [], issue.path.join('.'));
  try { validateScopeIntegrity(s); } catch (error) { add('source-integrity', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], errorMessage(error)); }
  const readiness = canGenerateDownstream(s);
  if (!readiness.eligible) add('scope-approval', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], readiness.reasons.join(' '));
  for (const id of coverage.scope.uncoveredIds) add('scope-coverage', 'UNCOVERED_REQUIREMENT', 'WARNING', [{ kind: 'Requirement', id }], `${s.requirements[id]!.priority} requirement ${id} has no current accepted capability coverage.`, ['inclusion']);
  for (const stage of ['design', 'delivery'] as const) for (const id of coverage[stage].uncoveredIds) add(`${stage}-coverage-gap`, 'UNCOVERED_REQUIREMENT', 'WARNING', [{ kind: 'Requirement', id }], `${s.requirements[id]!.priority} requirement ${id} has no current accepted ${stage} coverage.`, ['inclusion']);

  const active = Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE').sort((a, b) => a.id.localeCompare(b.id));
  const accepted = active.filter(a => a.review === 'REVIEWED');
  for (const a of active) {
    const refs = [node(a.id)], p = a.payload;
    // Phase 1 analysis paragraphs are evidence-backed context, not Phase 2
    // acceptance candidates. Their source anchors are validated above.
    if (s.artifacts[a.artifactId]?.kind === 'ANALYSIS') continue;
    if (a.review !== 'REVIEWED' || a.reviewedRevision !== a.revision) add('section-review', 'STRUCTURAL_INTEGRITY', 'ERROR', refs, `${a.title}: current canonical section requires acceptance.`);
    if (a.freshness === 'STALE') add('required-freshness', 'STRUCTURAL_INTEGRITY', 'ERROR', [...refs, ...a.staleCauses], `${a.title}: required content is stale; update the affected content.`, ['payload']);
    const problems = p.kind === 'EstimateSummary' ? [] : groundingProblems(s, a);
    if (problems.length) add('reviewed-grounding', p.kind === 'ArchitectureComponent' ? 'UNJUSTIFIED_COMPONENT' : ['Capability', 'Integration', 'AIUseCase'].includes(p.kind) ? 'UNSUPPORTED_SCOPE' : 'STRUCTURAL_INTEGRITY', 'ERROR', [...refs, ...a.grounding.map(g => g.source)], `${a.title}: ${problems.join(' ')}`, ['grounding']);
    if (!['EstimationUnit', 'EstimateItem', 'EstimateSummary'].includes(p.kind)) try { validateSections(s, [a]); } catch (error) { add('section-consistency', 'STRUCTURAL_INTEGRITY', 'ERROR', refs, errorMessage(error), ['payload']); }
    if (!s.artifacts[a.artifactId]?.sectionIds.includes(a.id)) add('artifact-membership', 'STRUCTURAL_INTEGRITY', 'ERROR', refs, 'Section must belong to its declared artifact.', ['sectionIds']);
    for (const input of a.inputs) if (!referenceExists(s, input.node)) add('input-reference', 'STRUCTURAL_INTEGRITY', 'ERROR', [node(a.id), input.node], 'Consumed input reference is unavailable.', ['inputs']);
    if (p.kind === 'Composite' && p.sectionIds.some(id => !s.artifactSections[id])) add('composite-reference', 'STRUCTURAL_INTEGRITY', 'ERROR', refs, 'Composite references an unavailable section.', ['payload.sectionIds']);
    if (p.kind === 'AIUseCase' && a.applicability?.state !== 'NOT_APPLICABLE') {
      for (const field of ['evaluation', 'privacy', 'safety', 'monitoring', 'feedback', 'humanReviewControls', 'humanDecisions', 'deterministicAlternative'] as const) {
        const value = p[field];
        if (!value || value.state === 'UNRESOLVED' || value.state === 'KNOWN' && !value.value.trim() || value.state === 'NOT_APPLICABLE' && ['evaluation', 'privacy', 'safety', 'humanReviewControls', 'humanDecisions', 'deterministicAlternative'].includes(field)) add('ai-controls', 'INCOMPLETE_AI_CONTROLS', 'WARNING', refs, `${a.title}: ${field} requires a reviewed applicable control.`, [`payload.${field}`]);
      }
    }
  }
  for (const diagnostic of deriveDependencyIndex(s).diagnostics) {
    const target = diagnostic.node.kind === 'ArtifactSection' ? s.artifactSections[diagnostic.node.id] : undefined;
    if (target && s.artifacts[target.artifactId]?.kind === 'ANALYSIS') continue;
    add('dependency-integrity', 'STRUCTURAL_INTEGRITY', 'ERROR', [diagnostic.node], diagnostic.reason, ['inputs'], diagnostic.reason);
  }
  for (const artifact of Object.values(s.artifacts)) for (const id of artifact.sectionIds) if (!s.artifactSections[id] || s.artifactSections[id]!.artifactId !== artifact.id) add('artifact-membership', 'STRUCTURAL_INTEGRITY', 'ERROR', [{ kind: 'Artifact', id: artifact.id }], `Artifact membership ${id} is broken.`, ['sectionIds'], id);

  // Missing required inventories are different from an explicit reviewed applicability record.
  for (const kind of ['PRD', 'FUNCTIONAL_SCOPE', 'ARCHITECTURE', 'DATA_STRATEGY', 'INTEGRATION_STRATEGY', 'AI_STRATEGY', 'DELIVERY_PLAN', 'ESTIMATE'] as const) if (!Object.values(s.artifacts).some(a => a.kind === kind && a.sectionIds.some(id => accepted.some(x => x.id === id)))) add('required-artifact', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], `Missing accepted ${kind} artifact or reviewed applicability.`, [], kind);
  for (const [kind, payloadKind] of [['FUNCTIONAL_SCOPE', 'Capability'], ['ARCHITECTURE', 'ArchitectureComponent'], ['DATA_STRATEGY', 'DataDomain'], ['INTEGRATION_STRATEGY', 'Integration'], ['AI_STRATEGY', 'AIUseCase'], ['DELIVERY_PLAN', 'Workstream']] as const) {
    if (!accepted.some(a => s.artifacts[a.artifactId]?.kind === kind && (a.payload.kind === payloadKind || a.applicability?.state === 'NOT_APPLICABLE'))) add('required-inventory', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], `${kind} requires an accepted ${payloadKind} inventory or a reviewed not-applicable record.`, [], kind);
  }
  for (const topic of PRD_TOPICS) if (!accepted.some(a => s.artifacts[a.artifactId]?.kind === 'PRD' && a.payload.kind === 'Narrative' && a.payload.topic === topic)) add('required-prd-topic', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], `PRD is missing ${topic}.`, [], topic);
  for (const topic of ['DEPLOYMENT', 'ENVIRONMENTS', 'AVAILABILITY', 'SCALABILITY', 'RECOVERY'] as const) if (!accepted.some(a => s.artifacts[a.artifactId]?.kind === 'ARCHITECTURE' && a.payload.kind === 'Narrative' && a.payload.topic === topic)) add('required-architecture-topic', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], `Architecture is missing ${topic} or its reviewed applicability.`, [], topic);
  try { const diagram = buildDiagram(accepted.filter(a => a.freshness === 'CURRENT')); if (!diagram.nodes.length) throw new Error('Required architecture diagram has no components.'); } catch (error) { add('diagram-integrity', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], errorMessage(error)); }
  if (options.diagramRendered === false) add('diagram-render', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode], 'The architecture diagram failed to render. Repair the diagram and run quality again.');

  const units = active.filter(a => a.payload.kind === 'EstimationUnit');
  for (const a of accepted.filter(a => ['Capability', 'Integration', 'AIUseCase', 'ArchitectureComponent'].includes(a.payload.kind) && !(a.payload.kind === 'Capability' && a.payload.inclusion === 'EXCLUDED') && a.applicability?.state !== 'NOT_APPLICABLE')) {
    const represented = units.some(u => {
      if (u.payload.kind !== 'EstimationUnit' || !acceptedCurrent(s, u) || u.payload.quantity.state !== 'KNOWN' || u.payload.quantity.value !== 1) return false;
      const owner = s.artifactSections[u.payload.workstreamId]; if (!owner || !acceptedCurrent(s, owner) || owner.payload.kind !== 'Workstream') return false;
      const source = u.payload.source;
      return source.kind === 'DOMAIN' ? source.sectionId === a.id : source.kind === 'ENVIRONMENT' ? source.scopeRefs.includes(a.id) : false;
    });
    if (!represented) add('delivery-coverage', 'MISSING_WORKSTREAM', 'WARNING', [node(a.id)], `${a.title}: included design lacks an eligible implementation unit and delivery workstream.`, ['payload']);
  }
  for (const a of units) if (a.payload.kind === 'EstimationUnit' && !(a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 0)) {
    const results = active.filter(r => r.payload.kind === 'EstimateItem' && r.payload.unitId === a.id);
    if (results.length !== 1) add('unit-result-coverage', 'STRUCTURAL_INTEGRITY', 'ERROR', [node(a.id)], 'Included unit must have exactly one current estimate result.', ['payload.unitId']);
  }

  for (const q of Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE' && q.status === 'OPEN')) add('open-question', 'UNRESOLVED_QUESTION', 'WARNING', [{ kind: 'Question', id: q.id }, ...q.related], `${q.criticality}: ${q.question}`, ['status']);
  for (const a of Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE')) {
    if (a.validation !== 'CONFIRMED') add('assumption-validation', 'UNVALIDATED_ASSUMPTION', a.review === 'REVIEWED' && a.validation === 'PROVISIONAL' ? 'WARNING' : 'ERROR', [{ kind: 'Assumption', id: a.id }], `${a.id}: ${a.validation}; human factual validation is required.`, ['validation']);
    else if (!a.confirmation?.note.trim() || a.reviewedRevision !== a.revision) add('assumption-confirmation', 'UNVALIDATED_ASSUMPTION', 'ERROR', [{ kind: 'Assumption', id: a.id }], 'Confirmation must identify the current reviewed assumption.', ['confirmation']);
  }
  const checks = compatibilityResults(s, accepted);
  for (const result of checks) if (result.status !== 'COMPATIBLE') add('technology-compatibility', result.status === 'CONFLICT' ? 'TECHNOLOGY_CONFLICT' : 'TECHNOLOGY_UNKNOWN', result.status === 'CONFLICT' && result.strength === 'MUST' ? 'ERROR' : 'WARNING', [result.constraint.node, ...(result.choice ? [result.choice.node] : [])], result.reason, ['technologyConstraints', 'technologyChoices'], result.constraintKey + ':' + result.choiceKey);

  for (const run of Object.values(s.generationRuns)) {
    if (run.state === 'SUCCEEDED' && run.acceptance === 'PENDING' && (run.acceptanceRevision ?? run.baseSessionRevision) !== s.revision) add('proposal-snapshot', 'STRUCTURAL_INTEGRITY', 'WARNING', [{ kind: 'GenerationRun', id: run.id }], 'Pending proposals were prepared against an obsolete session snapshot. Generate fresh proposals before accepting them.');
    for (const proposal of run.proposals) {
      if (!('candidate' in proposal) || proposal.candidate.kind !== 'ArtifactSection' || 'id' in proposal.target && run.decisions?.[proposal.target.id] === 'ACCEPTED') continue;
      const a = proposal.candidate.record, problems = groundingProblems(s, a);
      if (problems.length) add('proposal-grounding', a.payload.kind === 'ArchitectureComponent' ? 'UNJUSTIFIED_COMPONENT' : 'UNSUPPORTED_SCOPE', 'WARNING', [{ kind: 'GenerationRun', id: run.id }], `Unaccepted proposal ${a.title}: ${problems.join(' ')}`, ['grounding'], a.id);
      for (const result of compatibilityResults(s, [a])) if (result.status !== 'COMPATIBLE') add('proposal-technology', result.status === 'CONFLICT' ? 'TECHNOLOGY_CONFLICT' : 'TECHNOLOGY_UNKNOWN', 'WARNING', [{ kind: 'GenerationRun', id: run.id }], result.reason, ['technologyChoices'], `${a.id}:${result.constraintKey}`);
    }
  }

  const estimates = active.filter(a => a.payload.kind === 'EstimateItem' || a.payload.kind === 'EstimateSummary');
  const summaries = estimates.filter(a => a.payload.kind === 'EstimateSummary');
  if (summaries.length !== 1) add('estimate-summary-cardinality', 'STRUCTURAL_INTEGRITY', 'ERROR', [sessionNode, ...summaries.map(a => node(a.id))], 'The solution must have exactly one active estimate summary.', ['payload.kind']);
  const includedResults = estimates.filter(a => {
    const p = a.payload;
    return p.kind === 'EstimateItem' && units.some(u => u.id === p.unitId && u.payload.kind === 'EstimationUnit' && !(u.payload.quantity.state === 'KNOWN' && u.payload.quantity.value === 0));
  }).map(a => a.id).sort();
  for (const summary of summaries) if (summary.payload.kind === 'EstimateSummary' && canonicalJSON([...summary.payload.estimateIds].sort()) !== canonicalJSON(includedResults)) add('estimate-summary-membership', 'STRUCTURAL_INTEGRITY', 'ERROR', [node(summary.id)], 'Summary membership must include each active included unit result exactly once, without missing or extra results.', ['payload.estimateIds']);
  for (const a of estimates) if (a.payload.kind === 'EstimateItem' || a.payload.kind === 'EstimateSummary') {
    for (const gap of a.payload.missingInputs) add('estimate-input', 'MISSING_ESTIMATE_INPUT', 'WARNING', [node(a.id), gap.node], gap.reason, [gap.field]);
    if (a.payload.confidence !== 'HIGH') for (const limitation of a.payload.limitations) add('estimate-limitation', 'ESTIMATION_LIMITATION', 'WARNING', [node(a.id), ...limitation.related], limitation.reason, [], limitation.reason);
  }
  if (estimates.length && schema.success) {
    try {
      // Remove current quality bookkeeping from the verification clone. The engine alone
      // reconstructs all arithmetic, rules, ledger rows and summary membership.
      const reproduced = calculateEstimate(s, '2000-01-01T00:00:00Z', { mode: 'FULL' });
      for (const a of estimates) {
        const expected = reproduced.artifactSections[a.id];
        if (!expected || canonicalJSON(calculationContent(a.payload)) !== canonicalJSON(calculationContent(expected.payload))) add('estimate-reproduction', 'COMMERCIAL_INCONSISTENCY', 'ERROR', [node(a.id)], `${a.title}: stored values or ledger do not match the deterministic engine for current inputs. Recalculate the affected estimate.`, ['payload']);
      }
    } catch (error) { add('estimate-reproduction', 'COMMERCIAL_INCONSISTENCY', 'ERROR', [sessionNode], `Cannot reproduce estimate: ${errorMessage(error)}`, ['payload']); }
  }
  const issues = [...findings.values()].sort((a, b) => a.key.localeCompare(b.key));
  const status = issues.some(i => i.blocking) ? 'BLOCKED' : issues.length ? 'REVIEW_REQUIRED' : 'PASS';
  return QualityGateSchema.parse({ id: `GATE_${String(s.revision).padStart(2, '0')}`, evaluatedRevision: s.revision, ruleVersion: QUALITY_RULE_VERSION, issues, coverage, compatibilityResults: checks.map(c => CompatibilityResultSchema.parse({ constraint: c.constraint, choice: c.choice, status: c.status, ruleIds: c.ruleIds, catalog: c.catalog, reason: c.reason })), status });
}

// Consumed revisions retain historical provenance. Collection counters advance
// when the engine first creates result sections without changing the collection
// values consumed by a schedule. Compare every substantive ledger value/hash,
// while permitting that historical revision to differ on an identical rerun.
function calculationContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(calculationContent);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const input = 'node' in record && 'fields' in record && 'valueHash' in record;
  return Object.fromEntries(Object.entries(record).filter(([key]) => !(input && key === 'consumedRevision')).map(([key, child]) => [key, calculationContent(child)]));
}

function referenceExists(s: ScopingSession, n: NodeRef): boolean {
  switch (n.kind) {
    case 'ScopingSession': return n.id === s.id;
    case 'Requirement': return !!s.requirements[n.id];
    case 'Assumption': return !!s.assumptions[n.id];
    case 'Question': return !!s.questions[n.id];
    case 'SourceDocument': return !!s.documents[n.id];
    case 'SourceSection': return !!s.sourceSections[n.id];
    case 'Artifact': return !!s.artifacts[n.id];
    case 'ArtifactSection': return !!s.artifactSections[n.id];
    case 'GenerationRun': return !!s.generationRuns[n.id];
    // Missing config values are valid incomplete inputs, diagnosed by estimation.
    case 'CONFIGURATION': case 'COLLECTION': case 'RULESET': case 'AWS_CATALOG': case 'TECH_COMPATIBILITY': case 'DOCUMENT_TEMPLATE': return true;
  }
}
