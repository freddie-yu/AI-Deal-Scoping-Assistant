import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import type { ProviderRequest } from '../../src/ai/provider.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import type { ScopingSession } from '../../src/domain/index.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { deriveDependencyIndex } from '../../src/traceability/dependencies.js';
import { artifactEligible, inputsCurrent } from '../../src/application/deliverable-inputs.js';
import { validateRegenerationFixture } from '../../src/generators/mock-regeneration.js';
import { QualityCommands } from '../../src/application/quality.js';
vi.setConfig({ testTimeout: 60000 });
let directory: string; let repo: JsonSessionRepository;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'regeneration-')); repo = new JsonSessionRepository(directory); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
async function prepared(seed = 'modernization') { let s = await approvedSeed(repo, seed); for (const op of ['prd-scope', 'architecture'] as const) s = await generateAndAccept(repo, s, op); return s; }
async function approve(s: ScopingSession) { const commands = new ScopeCommands(repo); for (const kind of ['requirements', 'assumptions', 'questions'] as const) for (const r of Object.values(s[kind])) if (r.review !== 'REVIEWED' || r.reviewedRevision !== r.revision) s = await commands.review(s.id, kind, r.id, { expectedRevision: s.revision }); return commands.approve(s.id, { expectedRevision: s.revision }); }
async function refresh(s: ScopingSession, commands = new DeliverableCommands(repo)) { for (let attempt = 0; attempt < 30; attempt++) {
  if (!Object.values(s.artifactSections).some(a => a.freshness === 'STALE' && s.artifacts[a.artifactId]!.kind !== 'ANALYSIS')) return s;
  s = await commands.generateAffected(s.id, { expectedRevision: s.revision }); const run = Object.values(s.generationRuns).at(-1)!;
  for (const p of run.proposals) if (p.target.kind === 'ArtifactSection') s = await commands.review(s.id, run.id, p.target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
} throw Error('Regeneration did not converge'); }
async function stale(s: ScopingSession, keys: string[]) { const revision = s.revision; for (const a of Object.values(s.artifactSections)) if (keys.includes(a.sectionKey)) { a.freshness = 'STALE'; a.staleCauses = [{ kind: 'Requirement', id: 'NFR_01' }]; } s.revision++; await repo.save(s, revision); return s; }
it('records only per-section consumed scope and never priority on architecture', async () => {
  const s = await prepared(); const architecture = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:runtime')!;
  expect(architecture.inputs.filter(i => i.node.kind === 'Requirement').map(i => i.node.kind === 'Requirement' && i.node.id).sort()).toEqual(architecture.grounding.filter(g => g.source.kind === 'Requirement').map(g => g.source.id).sort());
  expect(architecture.inputs.flatMap(i => i.fields)).not.toContain('priority');
  expect(architecture.inputs.some(i => i.node.kind === 'SourceDocument')).toBe(false);
  const capability = Object.values(s.artifactSections).find(a => a.payload.kind === 'Capability')!;
  expect(capability.inputs.flatMap(i => i.fields)).toContain('priority');
  expect(JSON.stringify(Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:scalability')!.payload)).toContain('5000');
});
it('uses bounded context and leaves accepted stale content intact until acceptance; rejection preserves it', async () => {
  let s = await stale(await prepared(), ['ARCHITECTURE:scalability', 'ARCHITECTURE:availability']); const before = structuredClone(s.artifactSections);
  let request: ProviderRequest | undefined; const mock = new MockAIProvider();
  const commands = new DeliverableCommands(repo, { generate: async r => { request = r; return mock.generate(r); } });
  s = await commands.generateAffected(s.id, { expectedRevision: s.revision });
  expect(s.artifactSections).toEqual(before);
  expect(request!.requestedItemIds).toHaveLength(2);
  expect(request!.context).toEqual({});
  expect(request!.boundedContext).toBeDefined();
  const run = Object.values(s.generationRuns).at(-1)!;
  for (const target of request!.boundedContext!.targets) for (const supplied of target.inputs) {
    const manifest = run.inputs.find(i => JSON.stringify(i.node) === JSON.stringify(supplied.node) && i.fields.every(field => Object.hasOwn(supplied.values, field)));
    expect(manifest?.fields.slice().sort()).toEqual(Object.keys(supplied.values).sort());
  }
  expect(run.allowedTargets).toEqual(request!.requestedItemIds);
  const first = run.proposals[0]!.target; const second = run.proposals[1]!.target;
  if (first.kind !== 'ArtifactSection' || second.kind !== 'ArtifactSection') throw Error('Wrong targets');
  s = await commands.review(s.id, run.id, first.id, { expectedRevision: s.revision, decision: 'REJECTED' });
  expect(s.artifactSections).toEqual(before);
  s = await commands.review(s.id, run.id, second.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(s.artifactSections[second.id]!.freshness).toBe('CURRENT');
  expect(s.artifactSections[first.id]).toEqual(before[first.id]);
  for (const [id, section] of Object.entries(before)) if (id !== second.id) expect(s.artifactSections[id]).toEqual(section);
});
it('respects same-stage dependencies by proposing only the ready upstream target', async () => {
  let s = await stale(await prepared(), ['ARCHITECTURE:runtime', 'ARCHITECTURE:api']);
  s = await new DeliverableCommands(repo).generateAffected(s.id, { expectedRevision: s.revision });
  const run = Object.values(s.generationRuns).at(-1)!;
  expect(run.proposals).toHaveLength(1);
  expect(run.proposals[0]!.action !== 'RETIRE' && run.proposals[0]!.candidate.kind === 'ArtifactSection' && run.proposals[0]!.candidate.record.sectionKey).toBe('ARCHITECTURE:runtime');
});
it('rejects provider additions outside application-owned targets without changing accepted content', async () => {
  let s = await stale(await prepared(), ['ARCHITECTURE:scalability']); const before = structuredClone(s.artifactSections); const mock = new MockAIProvider();
  const commands = new DeliverableCommands(repo, { generate: async r => { const result = await mock.generate(r); const output = result.output as { sections: Record<string, unknown>[] }; output.sections.push({ ...output.sections[0], key: 'unauthorized' }); return result; } });
  await expect(commands.generateAffected(s.id, { expectedRevision: s.revision })).rejects.toThrow(/bound|target/i);
  s = await repo.load(s.id); expect(s.artifactSections).toEqual(before); expect(Object.values(s.generationRuns).at(-1)!.proposals).toEqual([]);
});
it('does not include later stages or accept a run after a newer domain edit', async () => {
  let s = await stale(await prepared(), ['PRD:prd-non-functional-requirements', 'ARCHITECTURE:scalability']); const commands = new DeliverableCommands(repo);
  s = await commands.generateAffected(s.id, { expectedRevision: s.revision }); const run = Object.values(s.generationRuns).at(-1)!;
  expect(run.operation).toBe('prd-scope'); expect(run.proposals).toHaveLength(1);
  const revision = s.revision; s.context.opportunityName += ' updated'; s.revision++; await repo.save(s, revision);
  const target = run.proposals[0]!.target; if (target.kind !== 'ArtifactSection') throw Error('Wrong target');
  await expect(commands.review(s.id, run.id, target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' })).rejects.toMatchObject({ code: 'CONFLICT' });
});
it('refreshes the recorded scale variant in bounded stages and preserves persona, workflow, and source bytes', async () => {
  let s = await prepared(); const before = structuredClone(s); const scope = new ScopeCommands(repo);
  const r = Object.values(s.requirements).find(r => r.measures?.expectedUsers)!;
  s = await scope.changeExpectedUsers(s.id, r.id, { expectedRevision: s.revision, value: 500000, basis: 'Reviewed planning target' });
  await expect(new DeliverableCommands(repo).generateAffected(s.id, { expectedRevision: s.revision })).rejects.toThrow(/scope|review|Approve/i);
  s = await refresh(await approve(s));
  const scale = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:scalability')!;
  expect(JSON.stringify(scale.payload)).toContain('500000'); expect(JSON.stringify(scale.payload)).toContain('autoscaling');
  const assumptions = Object.values(s.artifactSections).find(a => a.sectionKey === 'PRD:prd-assumptions')!;
  expect(JSON.stringify(assumptions.payload)).toContain('500,000');
  const overview = Object.values(s.artifactSections).find(a => a.sectionKey === 'PRD:prd-overview')!;
  expect(JSON.stringify(overview.payload)).toContain('500,000'); expect(JSON.stringify(overview.payload)).not.toContain('5,000 registered');
  for (const a of Object.values(before.artifactSections).filter(a => ['PRD:prd-personas', 'FUNCTIONAL_SCOPE:cap-fr-01', 'ARCHITECTURE:runtime'].includes(a.sectionKey))) expect(s.artifactSections[a.id]).toEqual(a);
  expect(s.documents).toEqual(before.documents); expect(s.lastImpact!.evaluatedRevision).toBe(s.revision);
});
it('rejects unsupported assumption changes without declaring stale content current', async () => {
  let s = await prepared(); const scope = new ScopeCommands(repo); const a = Object.values(s.assumptions)[0]!;
  s = await scope.editAssumption(s.id, a.id, { expectedRevision: s.revision, patch: { statement: 'Invent a new global analytics product unrelated to the recorded seed.' } });
  s = await approve(s); const before = structuredClone(s.artifactSections);
  await expect(new DeliverableCommands(repo).generateAffected(s.id, { expectedRevision: s.revision })).rejects.toThrow(/recorded|supported/i);
  expect((await repo.load(s.id)).artifactSections).toEqual(before);
});
it('rebuilds dependency relationships after accepting a structural proposal and permits its independent sibling', async () => {
  let s = await stale(await prepared(), ['ARCHITECTURE:api', 'ARCHITECTURE:scalability']); const mock = new MockAIProvider();
  const api = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:api')!;
  const runtime = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:runtime')!;
  const commands = new DeliverableCommands(repo, { generate: async request => { const result = await mock.generate(request); const output = result.output as { sections: { key: string; dependencies: string[]; payload: { connections?: unknown[] } }[] }; const candidate = output.sections.find(c => c.key === 'api')!; candidate.dependencies = []; candidate.payload.connections = []; return result; } });
  s = await commands.generateAffected(s.id, { expectedRevision: s.revision }); const run = Object.values(s.generationRuns).at(-1)!;
  s = await commands.review(s.id, run.id, api.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(s.lastImpact!.evaluatedRevision).toBe(s.revision);
  expect(deriveDependencyIndex(s).edges.some(e => 'id' in e.upstream && e.upstream.id === runtime.id && 'id' in e.downstream && e.downstream.id === api.id)).toBe(false);
  const sibling = run.proposals.find(p => p.target.kind === 'ArtifactSection' && p.target.id !== api.id)!.target;
  if (sibling.kind !== 'ArtifactSection') throw Error('Wrong target');
  s = await commands.review(s.id, run.id, sibling.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(s.artifactSections[api.id]!.payload).toMatchObject({ connections: [] }); expect(s.artifactSections[sibling.id]!.freshness).toBe('CURRENT');
});
it('projects optional configuration values and blocks unvalidated configuration from new use without changing freshness', async () => {
  let s = await generateAndAccept(repo, await prepared('ai-enabled'), 'strategies');
  const previousRevision = s.revision;
  for (const [key, value] of [['cloud', 'AWS'], ['aiProviderPreference', 'Amazon Bedrock']] as const) s.configuration.entries[key] = { key, revision: 1, kind: 'VALUE', value: { state: 'KNOWN', value }, basis: 'Reviewed solution preference', origin: 'ASSUMED', validation: 'VALIDATED' };
  s.revision++; await repo.save(s, previousRevision);
  s = await stale(s, ['AI_STRATEGY:support-drafts']);
  let request: ProviderRequest | undefined; const mock = new MockAIProvider();
  const commands = new DeliverableCommands(repo, { generate: async r => { request = r; return mock.generate(r); } });
  s = await commands.generateAffected(s.id, { expectedRevision: s.revision });
  const run = Object.values(s.generationRuns).at(-1)!;
  const configurationInputs = request!.boundedContext!.targets[0]!.inputs.filter(i => i.node.kind === 'CONFIGURATION');
  expect(configurationInputs.map(i => i.node.kind === 'CONFIGURATION' && i.node.key).sort()).toEqual(['aiProviderPreference', 'cloud']);
  expect(configurationInputs.map(i => i.values.value)).toEqual([{ state: 'KNOWN', value: 'AWS' }, { state: 'KNOWN', value: 'Amazon Bedrock' }]);
  expect(inputsCurrent(s, run.inputs)).toBe(true);
  const target = run.proposals[0]!.target; if (target.kind !== 'ArtifactSection') throw Error('Wrong target');
  s = await commands.review(s.id, run.id, target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  const accepted = structuredClone(s.artifactSections[target.id]!);
  expect(artifactEligible(s, accepted)).toBe(true);
  const revision = s.revision;
  s.configuration.entries.aiProviderPreference!.validation = 'UNVALIDATED'; s.revision++; await repo.save(s, revision);
  expect(inputsCurrent(s, accepted.inputs)).toBe(true);
  expect(artifactEligible(s, accepted)).toBe(false);
  expect(s.artifactSections[target.id]).toEqual(accepted);
  s = await stale(s, ['AI_STRATEGY:support-drafts']); const before = structuredClone(s.artifactSections);
  await expect(commands.generateAffected(s.id, { expectedRevision: s.revision })).rejects.toThrow(/config|validat/i);
  expect((await repo.load(s.id)).artifactSections).toEqual(before);
});
it.each(['modernization', 'missing-information'])('rejects mismatched units in the finite %s scale fixture', async seed => {
  const s = await approvedSeed(repo, seed);
  const key = seed === 'modernization' ? 'expectedUsers' : 'concurrency';
  const requirement = Object.values(s.requirements).find(r => r.measures?.[key])!;
  requirement.measures![key] = { state: 'KNOWN', value: { value: seed === 'modernization' ? 500000 : 100, unit: 'unrelated units' } };
  await expect(validateRegenerationFixture(s)).rejects.toThrow(/recorded|supported/i);
});
it('accepts the recorded supervisor variant through reviewed scope and bounded selective proposals', async () => {
  let s = await generateAndAccept(repo, await prepared('ai-enabled'), 'strategies');
  const before = structuredClone(s); const scope = new ScopeCommands(repo);
  const requirement = Object.values(s.requirements).find(r => r.description === 'A support agent must approve every reply before it is sent.')!;
  const assumption = Object.values(s.assumptions)[0]!;
  const description = 'A support agent and supervisor must approve every reply before it is sent.';
  s = await scope.editAssumption(s.id, assumption.id, { expectedRevision: s.revision, patch: { statement: description, basis: 'Reviewed two-person approval planning requirement', validation: 'PROVISIONAL' } });
  s = await scope.editRequirement(s.id, requirement.id, { expectedRevision: s.revision, patch: { description, origin: 'ASSUMED', basis: 'Reviewed two-person approval planning requirement', assumptionIds: [assumption.id] } });
  s = await refresh(await approve(s));
  const strategy = Object.values(s.artifactSections).find(a => a.sectionKey === 'AI_STRATEGY:support-drafts')!;
  expect(strategy).toMatchObject({ review: 'REVIEWED', freshness: 'CURRENT', payload: { kind: 'AIUseCase', humanDecisions: { state: 'KNOWN', value: 'A support agent and supervisor must approve every reply before sending.' } } });
  expect(JSON.stringify(strategy.payload)).toContain('Require both support-agent and supervisor approval records');
  expect(s.generationRuns[strategy.generationRunId!]!.fixtureVariant).toBe('phase4-selective');
  for (const a of Object.values(before.artifactSections).filter(a => ['ARCHITECTURE:database', 'FUNCTIONAL_SCOPE:cap-sec-01'].includes(a.sectionKey))) expect(s.artifactSections[a.id]).toEqual(a);
  expect(s.documents).toEqual(before.documents);
});
it('accepts the recorded concurrency-100 variant while retaining unrelated missing information', async () => {
  let s = await prepared('missing-information'); const before = structuredClone(s); const scope = new ScopeCommands(repo);
  const requirement = Object.values(s.requirements).find(r => r.measures?.concurrency)!;
  const assumption = Object.values(s.assumptions)[0]!;
  s = await scope.editAssumption(s.id, assumption.id, { expectedRevision: s.revision, patch: { statement: 'Planning target: 100 concurrent users.', basis: 'Reviewed capacity planning target', validation: 'PROVISIONAL', value: { kind: 'NUMBER', value: 100, unit: 'concurrent users' } } });
  s = await scope.editRequirement(s.id, requirement.id, { expectedRevision: s.revision, patch: { origin: 'ASSUMED', basis: 'Reviewed capacity planning target', measures: { concurrency: { state: 'KNOWN', value: { value: 100, unit: 'concurrent users' } } } } });
  s = await refresh(await approve(s));
  const scale = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:scalability')!;
  expect(scale).toMatchObject({ review: 'REVIEWED', freshness: 'CURRENT' });
  expect(JSON.stringify(scale.payload)).toContain('100 concurrent users');
  expect(s.generationRuns[scale.generationRunId!]!.fixtureVariant).toBe('phase4-selective');
  for (const a of Object.values(before.artifactSections).filter(a => ['ARCHITECTURE:database', 'FUNCTIONAL_SCOPE:cap-int-01'].includes(a.sectionKey))) expect(s.artifactSections[a.id]).toEqual(a);
  expect(Object.values(s.questions).filter(q => ['apiReadiness', 'rate'].includes(q.subject ?? ''))).toEqual(Object.values(before.questions).filter(q => ['apiReadiness', 'rate'].includes(q.subject ?? '')));
  expect(s.documents).toEqual(before.documents);
});
it.each(['full', 'selective'])('invalidates the quality snapshot on %s proposal generation and rejection without advancing domain revision', async mode => {
  let s = await stale(await prepared(), ['ARCHITECTURE:scalability']);
  const quality = new QualityCommands(repo); const commands = new DeliverableCommands(repo);
  s = await quality.evaluate(s.id, { expectedRevision: s.revision });
  expect(s.gate).toBeDefined(); const revision = s.revision;
  s = mode === 'selective' ? await commands.generateAffected(s.id, { expectedRevision: revision }) : await commands.generate(s.id, { expectedRevision: revision, operation: 'architecture' });
  expect(s.revision).toBe(revision); expect(s.gate).toBeUndefined();
  const run = Object.values(s.generationRuns).at(-1)!;
  s = await quality.evaluate(s.id, { expectedRevision: revision });
  expect(s.gate).toBeDefined();
  const target = run.proposals[0]!.target; if (target.kind !== 'ArtifactSection') throw Error('Wrong target');
  s = await commands.review(s.id, run.id, target.id, { expectedRevision: revision, decision: 'REJECTED' });
  expect(s.revision).toBe(revision); expect(s.gate).toBeUndefined();
  expect((await quality.read(s.id)).current).toBe(false);
});
