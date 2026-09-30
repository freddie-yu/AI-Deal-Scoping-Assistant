import { z } from 'zod';
import type { SessionRepository } from '../persistence/repository.js';
import type { AIProvider } from '../ai/provider.js';
import { MockAIProvider } from '../ai/mock.js';
import { ArtifactSectionSchema, type ArtifactSection, type ArtifactKind, type ScopingSession, type GenerationRun } from '../domain/index.js';
import { phase2Schemas, Phase2OperationSchema, PRD_TOPICS, type Phase2Operation, type SectionCandidate } from '../domain/deliverables.js';
import { allocateId } from '../domain/ids.js';
import { validateProposal } from '../validation/provider.js';
import { sectionReferences, technologyChecks, validateSections } from '../validation/deliverables.js';
import { canGenerateDownstream, scopeFingerprint } from './scope-review.js';
import { parseCommand } from './scope.js';
import { ConflictError, ValidationError } from './errors.js';
import { artifactEligible, artifactInput, compatibilityResults, configurationInputsEligible, inputsCurrent, resourceInputs, scopeInputs, sectionInputs } from './deliverable-inputs.js';
import { scopeCoverage } from '../traceability/coverage.js';
import { buildDiagram } from '../architecture/diagram.js';
import { regenerationContext, regenerationPlan } from './regeneration.js';
import { validateRegenerationFixture } from '../generators/mock-regeneration.js';
import { applyImpact } from '../impact/index.js';

function gate(s: ScopingSession) { const status = canGenerateDownstream(s); if (!status.eligible) throw new ValidationError(status.reasons.join(' '), ['scope']); }
function configurationGate(s: ScopingSession, inputs: GenerationRun['inputs']) { if (!configurationInputsEligible(s, inputs)) throw new ValidationError('Validate the consumed configuration before generation or acceptance.', ['configuration']); }
const generationCommand = z.object({ expectedRevision: z.number().int().positive(), operation: Phase2OperationSchema }).strict();
const reviewCommand = z.object({ expectedRevision: z.number().int().positive(), decision: z.enum(['ACCEPTED', 'REJECTED']) }).strict();
function eligibleDesign(s: ScopingSession) { return Object.values(s.artifactSections).filter(a => artifactEligible(s, a)); }

export class DeliverableCommands {
  constructor(private readonly repository: SessionRepository, private readonly provider: AIProvider = new MockAIProvider()) {}
  async generateAffected(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(z.object({ expectedRevision: z.number().int().positive() }).strict(), input);
    const snapshot = await this.repository.load(id); if (snapshot.revision !== expectedRevision) throw new ConflictError(); gate(snapshot);
    const { operation, targets } = regenerationPlan(snapshot);
    const { context, inputs } = regenerationContext(snapshot, targets);
    const allowedTargets = targets.map(a => ({ kind: 'ArtifactSection' as const, id: a.id }));
    try {
      configurationGate(snapshot, inputs);
      await validateRegenerationFixture(snapshot);
      const response = await this.provider.generate({ operation, context: {} as ScopingSession, boundedContext: context, schemaVersion: '2', requestedItemIds: allowedTargets, fixtureVariant: 'phase4-selective' });
      if (response.metadata.mode !== 'MOCK') throw new ValidationError('Only MOCK generation is enabled.', ['providerMode']);
      const result = await validateProposal(response, phase2Schemas[operation]);
      const keys = new Set(targets.map(a => a.sectionKey));
      if (result.proposal.sections.length !== targets.length || result.proposal.sections.some(c => !keys.delete(`${c.artifactKind}:${c.key}`)) || keys.size) throw new ValidationError('Provider response exceeds or omits the allowed target boundary.', ['targets']);
      // Grounding and relationship changes must use supplied inputs; a provider
      // cannot reach into hidden session state merely by guessing a valid ID.
      for (const c of result.proposal.sections) {
        const supplied = context.targets.find(t => `${t.candidate.artifactKind}:${t.candidate.key}` === `${c.artifactKind}:${c.key}`)!;
        for (const id of c.requirementIds) if (!supplied.inputs.some(i => i.node.kind === 'Requirement' && i.node.id === id)) throw new ValidationError('Grounding exceeds supplied input boundary.', ['inputs']);
        for (const id of c.assumptionIds) if (!supplied.inputs.some(i => i.node.kind === 'Assumption' && i.node.id === id)) throw new ValidationError('Grounding exceeds supplied input boundary.', ['inputs']);
      }
      return await this.repository.operational(id, expectedRevision, current => {
        gate(current); configurationGate(current, inputs); if (!inputsCurrent(current, inputs)) throw new ConflictError();
        const runId = allocateId(current, 'RUN');
        const sections = this.canonicalize(current, result.proposal.sections, runId, inputs);
        for (const a of sections) {
          const supplied = context.targets.find(t => t.id === a.id)!;
          for (const ref of sectionReferences(a)) if (ref.id !== a.id && !supplied.inputs.some(i => i.node.kind === 'ArtifactSection' && i.node.id === ref.id)) throw new ValidationError('Reference exceeds supplied input boundary.', ['inputs']);
        }
        validateSections(current, sections);
        current.generationRuns[runId] = { id: runId, operation, mode: 'MOCK', provider: result.metadata.provider, fixtureVariant: 'phase4-selective', schemaVersion: '2', baseSessionRevision: expectedRevision, acceptanceRevision: expectedRevision, scopeFingerprint: scopeFingerprint(current), inputs, allowedTargets, createWithin: [], state: 'SUCCEEDED', acceptance: 'PENDING', decisions: {}, proposals: sections.map(a => ({ action: 'UPDATE', target: { kind: 'ArtifactSection', id: a.id }, expectedRevision: current.artifactSections[a.id]!.revision, candidate: { kind: 'ArtifactSection', record: a } })) };
        current.collectionCounters.generationRuns++;
        delete current.gate; delete current.exportReceipt;
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      await this.repository.operational(id, expectedRevision, current => {
        const runId = allocateId(current, 'RUN');
        current.generationRuns[runId] = { id: runId, operation, mode: 'MOCK', schemaVersion: '2', fixtureVariant: 'phase4-selective', baseSessionRevision: expectedRevision, inputs, allowedTargets, createWithin: [], state: 'FAILED', acceptance: 'REJECTED', proposals: [], error: { code: error instanceof ValidationError ? error.code : 'PROVIDER_ERROR', message: error instanceof Error ? error.message : 'Regeneration failed.', paths: error instanceof ValidationError ? error.paths : [] } };
        current.collectionCounters.generationRuns++;
      });
      throw error;
    }
  }
  async generate(id: string, input: unknown) {
    const { expectedRevision, operation } = parseCommand(generationCommand, input);
    const snapshot = await this.repository.load(id); if (snapshot.revision !== expectedRevision) throw new ConflictError(); gate(snapshot);
    const context = structuredClone(snapshot);
    const accepted = eligibleDesign(snapshot);
    if (operation === 'architecture' && !accepted.some(a => a.payload.kind === 'Capability')) throw new ValidationError('Accept functional scope before architecture generation.', ['artifacts']);
    if (operation === 'strategies' && !accepted.some(a => a.payload.kind === 'ArchitectureComponent')) throw new ValidationError('Accept architecture before strategy generation.', ['artifacts']);
    if (operation === 'delivery' && !accepted.some(a => ['DataDomain', 'Integration', 'AIUseCase'].includes(a.payload.kind))) throw new ValidationError('Accept strategy before delivery generation.', ['artifacts']);
    context.generationRuns = {}; context.pendingChanges = [];
    context.configuration.entries = {};
    context.artifactSections = Object.fromEntries(accepted.map(a => [a.id, a]));
    const inputs = [...scopeInputs(snapshot), ...accepted.map(artifactInput), ...resourceInputs()];
    try {
      const response = await this.provider.generate({ operation, context, schemaVersion: '2', requestedItemIds: [], fixtureVariant: 'phase2-seed' });
      if (response.metadata.mode !== 'MOCK') throw new ValidationError('Only MOCK generation is enabled.', ['providerMode']);
      const result = await validateProposal(response, phase2Schemas[operation]);
      return await this.repository.operational(id, expectedRevision, current => {
        gate(current);
        if (current.scopeReviewFingerprint !== snapshot.scopeReviewFingerprint || !inputsCurrent(current, inputs)) throw new ConflictError();
        const runId = allocateId(current, 'RUN');
        const sections = this.canonicalize(current, result.proposal.sections, runId, inputs);
        this.completeInventory(operation, sections);
        configurationGate(current, sections.flatMap(a => a.inputs));
        validateSections(current, sections);
        const proposedIds = new Set(sections.map(a => a.id));
        const suppliedIds = new Set(accepted.map(a => a.id));
        for (const a of sections) for (const ref of sectionReferences(a)) if (!proposedIds.has(ref.id) && !suppliedIds.has(ref.id)) throw new ValidationError(`Reference ${ref.id} was not supplied as an eligible input.`, ['inputs']);
        const proposals: GenerationRun['proposals'] = sections.map(a => {
          const old = current.artifactSections[a.id];
          return old ? { action: 'UPDATE', target: { kind: 'ArtifactSection', id: a.id }, expectedRevision: old.revision, candidate: { kind: 'ArtifactSection', record: a } } : { action: 'CREATE', target: { kind: 'ArtifactSection', id: a.id }, candidate: { kind: 'ArtifactSection', record: a } };
        });
        current.generationRuns[runId] = { id: runId, operation, mode: 'MOCK', provider: result.metadata.provider, fixtureVariant: result.metadata.fixtureVariant, schemaVersion: '2', baseSessionRevision: expectedRevision, acceptanceRevision: expectedRevision, scopeFingerprint: scopeFingerprint(current), inputs, allowedTargets: proposals.map(p => p.target), createWithin: [...new Set(sections.map(a => a.artifactId))].map(artifactId => ({ kind: 'Artifact', id: artifactId })), state: 'SUCCEEDED', acceptance: 'PENDING', decisions: {}, proposals };
        current.collectionCounters.generationRuns++;
        delete current.gate; delete current.exportReceipt;
      });
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      // A failed operation retains only actionable diagnostics, never usable candidates.
      await this.repository.operational(id, expectedRevision, s => {
        const runId = allocateId(s, 'RUN');
        s.generationRuns[runId] = { id: runId, operation, mode: 'MOCK', schemaVersion: '2', baseSessionRevision: expectedRevision, inputs, allowedTargets: [], createWithin: [], state: 'FAILED', acceptance: 'REJECTED', proposals: [], error: { code: error instanceof ValidationError ? error.code : 'PROVIDER_ERROR', message: error instanceof Error ? error.message : 'Generation failed.', paths: error instanceof ValidationError ? error.paths : [] } };
        s.collectionCounters.generationRuns++;
      });
      throw error;
    }
  }
  private completeInventory(operation: Phase2Operation, sections: ArtifactSection[]) {
    if (operation === 'prd-scope') for (const topic of PRD_TOPICS) if (!sections.some(a => a.payload.kind === 'Narrative' && a.payload.topic === topic)) throw new ValidationError(`PRD is missing ${topic}.`, ['sections']);
    if (operation === 'architecture' && !sections.some(a => a.payload.kind === 'ArchitectureComponent')) throw new ValidationError('Architecture requires components.', ['sections']);
    if (operation === 'strategies') for (const kind of ['DATA_STRATEGY', 'INTEGRATION_STRATEGY', 'AI_STRATEGY']) if (!sections.some(a => a.artifactId && a.sectionKey.startsWith(`${kind}:`))) throw new ValidationError(`Strategy is missing ${kind}.`, ['sections']);
  }
  private canonicalize(s: ScopingSession, candidates: SectionCandidate[], runId: string, inputs: GenerationRun['inputs']): ArtifactSection[] {
    const keys = new Map<string, string>(); const artifacts = new Map<string, string>();
    for (const c of candidates) {
      if (keys.has(c.key)) throw new ValidationError('Duplicate proposal section key.', ['sections.key']);
      let artifact = Object.values(s.artifacts).find(a => a.kind === c.artifactKind);
      if (!artifact) { const id = allocateId(s, 'ART'); artifact = { id, revision: 1, kind: c.artifactKind as ArtifactKind, title: c.artifactKind.replaceAll('_', ' '), sectionIds: [], templateVersion: 'phase2-1' }; s.artifacts[id] = artifact; s.collectionCounters.artifacts++; }
      artifacts.set(c.key, artifact.id);
      const sectionKey = `${c.artifactKind}:${c.key}`;
      const old = Object.values(s.artifactSections).find(a => a.artifactId === artifact!.id && a.sectionKey === sectionKey);
      keys.set(c.key, old?.id ?? allocateId(s, 'AS'));
    }
    const bind = (value: unknown): unknown => {
      if (typeof value === 'string' && value.startsWith('local:')) { const id = keys.get(value.slice(6)); if (!id) throw new ValidationError(`Unknown local reference ${value}.`, ['sections']); return id; }
      if (Array.isArray(value)) return value.map(bind);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bind(v)]));
      return value;
    };
    return candidates.map(c => {
      const id = keys.get(c.key)!; const old = s.artifactSections[id];
      const grounding = [...c.requirementIds.map(id => ({ source: { kind: 'Requirement' as const, id }, reviewedRevision: s.requirements[id]?.revision ?? 1, rationale: c.rationale })), ...c.assumptionIds.map(id => ({ source: { kind: 'Assumption' as const, id }, reviewedRevision: s.assumptions[id]?.revision ?? 1, rationale: c.rationale }))];
      const payload = c.payload.kind === 'Narrative' ? { ...c.payload, paragraphs: c.payload.paragraphs.map(p => ({ ...p, anchors: [], grounding })) } : c.payload;
      const a = parseCommand(ArtifactSectionSchema, { id, artifactId: artifacts.get(c.key)!, sectionKey: `${c.artifactKind}:${c.key}`, title: c.title, origin: c.origin, payload: bind(payload), grounding, inputs: inputs.filter(i => i.node.kind !== 'ArtifactSection'), revision: (old?.revision ?? 0) + 1, lifecycle: 'ACTIVE', review: 'PROPOSED', freshness: 'CURRENT', staleCauses: [], lastChangedBy: 'MOCK', generationRunId: runId, technologyChoices: c.technologyChoices, dependencies: bind(c.dependencies), applicability: c.applicability });
      a.inputs = sectionInputs(s, a);
      return a;
    });
  }
  async review(id: string, runId: string, sectionId: string, input: unknown) {
    const { expectedRevision, decision } = parseCommand(reviewCommand, input);
    const s = await this.repository.load(id); if (s.revision !== expectedRevision) throw new ConflictError();
    const run = s.generationRuns[runId];
    if (!run || run.state !== 'SUCCEEDED' || run.acceptance !== 'PENDING' || run.decisions?.[sectionId]) throw new ValidationError('No pending section proposal to review.', ['proposal']);
    if ((run.acceptanceRevision ?? run.baseSessionRevision) !== expectedRevision) throw new ConflictError();
    const patch = run.proposals.find(p => p.target.kind === 'ArtifactSection' && p.target.id === sectionId);
    if (!patch || patch.action === 'RETIRE' || patch.candidate.kind !== 'ArtifactSection') throw new ValidationError('Unknown section proposal.', ['proposal']);
    if (decision === 'REJECTED') return this.repository.operational(id, expectedRevision, current => {
      const r = current.generationRuns[runId]!; if (r.decisions?.[sectionId]) throw new ConflictError();
      r.decisions = { ...r.decisions, [sectionId]: decision }; this.finishRun(r);
      delete current.gate; delete current.exportReceipt;
    });
    gate(s);
    if (run.scopeFingerprint !== scopeFingerprint(s) || !inputsCurrent(s, run.inputs.filter(i => !(i.node.kind === 'ArtifactSection' && run.decisions?.[i.node.id] === 'ACCEPTED')))) throw new ConflictError();
    const candidate = structuredClone(patch.candidate.record);
    configurationGate(s, candidate.inputs);
    const beforeAcceptance = structuredClone(s);
    if (patch.action === 'UPDATE' && s.artifactSections[sectionId]?.revision !== patch.expectedRevision || patch.action === 'CREATE' && s.artifactSections[sectionId]) throw new ConflictError();
    validateSections(s, [candidate], true);
    for (const ref of sectionReferences(candidate)) if (ref.id !== candidate.id && !artifactEligible(s, s.artifactSections[ref.id]!)) throw new ValidationError(`Dependency ${ref.id} has ineligible inputs; review a fresh proposal first.`, ['inputs']);
    // Record direct accepted design dependencies without generating a Phase 4 graph.
    candidate.inputs = [...candidate.inputs.filter(i => i.node.kind !== 'ArtifactSection'), ...[...new Set(sectionReferences(candidate).filter(r => r.id !== candidate.id).map(r => r.id))].map(id => artifactInput(s.artifactSections[id]!))];
    candidate.review = 'REVIEWED'; candidate.reviewedRevision = candidate.revision; candidate.reviewedAt = new Date().toISOString(); candidate.lastChangedBy = 'HUMAN';
    s.artifactSections[sectionId] = candidate;
    const artifact = s.artifacts[candidate.artifactId]!; if (!artifact.sectionIds.includes(sectionId)) { artifact.sectionIds.push(sectionId); s.collectionCounters.artifactSections++; } artifact.revision++;
    s.revision++; delete s.gate; delete s.exportReceipt;
    // Each accepted output can alter relationships. Rebuild and traverse from
    // this actual output diff, never reuse the pre-generation affected set.
    applyImpact(beforeAcceptance, s);
    run.decisions = { ...run.decisions, [sectionId]: decision }; run.acceptanceRevision = s.revision;
    // Accepted siblings are the only permitted changes to this run's captured snapshot.
    this.finishRun(run); await this.repository.save(s, expectedRevision); return s;
  }
  private finishRun(run: GenerationRun) { if (run.proposals.every(p => 'id' in p.target && run.decisions?.[p.target.id])) run.acceptance = Object.values(run.decisions ?? {}).some(d => d === 'ACCEPTED') ? 'ACCEPTED' : 'REJECTED'; }
  async read(id: string) {
    const s = await this.repository.load(id); const sections = Object.values(s.artifactSections).filter(a => s.artifacts[a.artifactId]?.kind !== 'ANALYSIS');
    const current = sections.filter(a => artifactEligible(s, a));
    return { sections, ineligibleSectionIds: sections.filter(a => !current.some(c => c.id === a.id)).map(a => a.id), compatibility: compatibilityResults(s, current), eligibility: canGenerateDownstream(s), coverage: scopeCoverage(s, new Set(current.map(a => a.id))), diagram: buildDiagram(current.filter(a => a.payload.kind === 'ArchitectureComponent')) };
  }
}
