import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import type { AIProvider } from '../../src/ai/provider.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { generateArchitecture } from '../../src/generators/architecture.js';
import { generateFunctionalScope } from '../../src/generators/prd.js';
import { phase2Schemas, type SectionCandidate } from '../../src/domain/deliverables.js';
import { validateSections, technologyChecks } from '../../src/validation/deliverables.js';
import { unsupportedAdditions, scopeCoverage } from '../../src/traceability/coverage.js';
import { buildDiagram } from '../../src/architecture/diagram.js';
import { createApp } from '../../src/server/app.js';
import type { ArtifactSection, ScopingSession } from '../../src/domain/index.js';
import { artifactEligible } from '../../src/application/deliverable-inputs.js';
import { generateDeliveryPlan } from '../../src/generators/delivery.js';
import { generateAIStrategy, generateDataIntegrationStrategy } from '../../src/generators/strategies.js';
let directory: string; let repo: JsonSessionRepository;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'p2-validation-')); repo = new JsonSessionRepository(directory); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
function altered(edit: (sections: SectionCandidate[]) => void): AIProvider { return { async generate(r) { const result = await new MockAIProvider().generate(r); const out = result.output as { sections: SectionCandidate[] }; edit(out.sections); return result; } }; }
async function architectureBasis() { return generateAndAccept(repo, await approvedSeed(repo), 'prd-scope'); }
function proposals(s: ScopingSession) { return Object.values(s.generationRuns).at(-1)!.proposals.flatMap(p => p.action !== 'RETIRE' && p.candidate.kind === 'ArtifactSection' ? [p.candidate.record] : []); }

it.each(['id', 'cloud', 'catalog', 'connection', 'grounding'])('rejects unsafe architecture %s and preserves canonical sections', async mutation => {
  const s = await architectureBasis(); const before = structuredClone(s.artifactSections);
  const provider = altered(sections => { const a = sections.find(a => a.payload.kind === 'ArchitectureComponent')!;
    if (mutation === 'id') Object.assign(a, { id: 'AS_9000' });
    if (a.payload.kind === 'ArchitectureComponent') {
      if (mutation === 'cloud') Object.assign(a.payload, { cloud: 'Azure' });
      if (mutation === 'catalog') a.payload.catalogServiceKey = 'aws:imaginary';
      if (mutation === 'connection') a.payload.connections.push({ from: { kind: 'COMPONENT', sectionId: 'AS_999' }, to: { kind: 'COMPONENT', sectionId: 'AS_998' }, description: 'invalid' });
    }
    if (mutation === 'grounding') a.requirementIds = ['FR_999'];
  });
  await expect(new DeliverableCommands(repo, provider).generate(s.id, { expectedRevision: s.revision, operation: 'architecture' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  const saved = await repo.load(s.id); expect(saved.artifactSections).toEqual(before); expect(Object.values(saved.generationRuns).at(-1)?.state).toBe('FAILED');
});
it('accepts legitimate assumption-only infrastructure without adding requirements or coverage', async () => {
  const s = await architectureBasis();
  const provider = altered(sections => { const a = sections.find(a => a.payload.kind === 'ArchitectureComponent')!; a.requirementIds = []; a.assumptionIds = ['ASM_01']; a.rationale = 'Reviewed planning participation supports an isolated validation environment.'; });
  const c = new DeliverableCommands(repo, provider); let next = await c.generate(s.id, { expectedRevision: s.revision, operation: 'architecture' });
  const run = Object.values(next.generationRuns).at(-1)!; const a = proposals(next)[0]!;
  next = await c.review(s.id, run.id, a.id, { expectedRevision: next.revision, decision: 'ACCEPTED' });
  expect(next.artifactSections[a.id]!.grounding.map(g => g.source.kind)).toEqual(['Assumption']); expect(next.requirements).toEqual(s.requirements); expect(scopeCoverage(next)).toEqual(scopeCoverage(s));
});
it('capability, integration and AI assumptions cannot substitute for requirement grounding', async () => {
  const s = await architectureBasis(); const a = Object.values(s.artifactSections).find(a => a.payload.kind === 'Capability')!;
  for (const kind of ['Capability', 'Integration', 'AIUseCase'] as const) {
    const unsupported = structuredClone(a); unsupported.payload = { ...a.payload, kind } as ArtifactSection['payload']; unsupported.grounding = [{ source: { kind: 'Assumption', id: 'ASM_01' }, reviewedRevision: 1, rationale: 'Assumption alone.' }];
    expect(unsupportedAdditions(s, [unsupported])[0]?.reasons.join(' ')).toContain('requirement is mandatory');
  }
});
it('rejects unsupported capabilities and retains uncovered and excluded rows separately', async () => {
  let s = await approvedSeed(repo); const scope = new ScopeCommands(repo);
  s = await scope.editRequirement(s.id, 'SEC_01', { expectedRevision: s.revision, patch: { inclusion: 'EXCLUDED', exclusionReason: 'Customer deferred this outcome.' } });
  s = await scope.review(s.id, 'requirements', 'SEC_01', { expectedRevision: s.revision }); s = await scope.approve(s.id, { expectedRevision: s.revision });
  const c = new DeliverableCommands(repo, altered(sections => { const cap = sections.find(a => a.payload.kind === 'Capability')!; cap.requirementIds = []; }));
  await expect(c.generate(s.id, { expectedRevision: s.revision, operation: 'prd-scope' })).rejects.toThrow();
  expect(scopeCoverage(s).uncoveredIds).toContain('FR_01'); expect(scopeCoverage(s).excluded[0]?.reason).toContain('deferred');
  expect(generateFunctionalScope(s).find(a => a.requirementIds.includes('SEC_01'))?.payload).toMatchObject({ classification: 'OUT_OF_SCOPE', inclusion: 'EXCLUDED' });
});
it('new regeneration preserves IDs and accepting one section preserves its siblings', async () => {
  let s = await architectureBasis(); const before = structuredClone(s.artifactSections); const c = new DeliverableCommands(repo);
  s = await c.generate(s.id, { expectedRevision: s.revision, operation: 'prd-scope' }); const run = Object.values(s.generationRuns).at(-1)!; const proposal = proposals(s)[0]!;
  expect(before[proposal.id]).toBeDefined(); s = await c.review(s.id, run.id, proposal.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  for (const [id, value] of Object.entries(before)) if (id !== proposal.id) expect(s.artifactSections[id]).toEqual(value);
  const second = proposals(s)[1]!; s = await c.review(s.id, run.id, second.id, { expectedRevision: s.revision, decision: 'REJECTED' }); expect(s.artifactSections[second.id]).toEqual(before[second.id]);
});
it('blocks mandatory technology conflicts and retains UNKNOWN for human review', async () => {
  const s = await architectureBasis(); const c = new DeliverableCommands(repo); const generated = await c.generate(s.id, { expectedRevision: s.revision, operation: 'architecture' }); const a = proposals(generated)[0]!;
  expect(technologyChecks(s, [a]).some(c => c.status === 'COMPATIBLE')).toBe(true);
  s.requirements.DATA_01!.technologyConstraints = [{ key: 'jvm', target: 'BACKEND', strength: 'MUST', kind: 'ALLOWED_RUNTIME', values: ['jvm'] }];
  a.technologyChoices!.push({ key: 'framework', target: 'BACKEND', technologyKey: { state: 'KNOWN', value: 'python-fastapi' } });
  expect(() => validateSections(s, [a], true)).toThrow('CONFLICT');
  s.requirements.DATA_01!.technologyConstraints = [{ key: 'suite', target: 'BACKEND', strength: 'MUST', kind: 'APPROVED_PRODUCT', values: ['customer-approved-suite'] }];
  expect(technologyChecks(s, [a]).some(c => c.status === 'UNKNOWN')).toBe(true);
});
it('diagram nodes and edges derive deterministically from validated structure and labels cannot inject syntax', async () => {
  const s = await architectureBasis(); const c = new DeliverableCommands(repo); const generated = await c.generate(s.id, { expectedRevision: s.revision, operation: 'architecture' }); const sections = proposals(generated);
  const diagram = buildDiagram(sections); expect(diagram.nodes.length).toBe(sections.filter(a => a.payload.kind === 'ArchitectureComponent').length);
  expect(diagram.edges.length).toBe(sections.reduce((n, a) => n + (a.payload.kind === 'ArchitectureComponent' ? a.payload.connections.length : 0), 0)); expect(buildDiagram([...sections].reverse())).toEqual(diagram);
  const p = sections[0]!.payload; if (p.kind === 'ArchitectureComponent') p.name = '<script>"\nclick AS_01 "javascript:alert(1)"';
  const safe = buildDiagram(sections).source; expect(safe).not.toContain('<script>'); expect(safe).not.toMatch(/\nclick/);
});
it('provider cannot inject authoritative numeric effort, ROM or estimation sections', async () => {
  const s = await approvedSeed(repo); const architecture = generateArchitecture(s);
  expect(phase2Schemas.architecture.safeParse({ sections: architecture }).success).toBe(true);
  for (const key of ['effort', 'personDays', 'timeline', 'ROM', 'confidence']) expect(phase2Schemas.delivery.safeParse({ sections: [{ ...architecture[0], artifactKind: 'DELIVERY_PLAN', payload: { kind: 'Workstream', [key]: 10 } }] }).success).toBe(false);
});
it('slow generation cannot commit after a concurrent scope edit', async () => {
  let s = await architectureBasis(); let release!: () => void; let entered!: () => void;
  const waiting = new Promise<void>(r => { release = r; }); const started = new Promise<void>(r => { entered = r; });
  const provider: AIProvider = { async generate(r) { entered(); await waiting; return new MockAIProvider().generate(r); } };
  const pending = new DeliverableCommands(repo, provider).generate(s.id, { expectedRevision: s.revision, operation: 'architecture' }); const rejection = expect(pending).rejects.toMatchObject({ code: 'CONFLICT' });
  await started; s = await new ScopeCommands(repo).editRequirement(s.id, 'FR_01', { expectedRevision: s.revision, patch: { priority: 'LOW' } }); release(); await rejection; expect(await repo.load(s.id)).toEqual(s);
});
it('API rejects generation after approval invalidation', async () => {
  let s = await approvedSeed(repo); const app = createApp(repo);
  s = await new ScopeCommands(repo).editRequirement(s.id, 'FR_01', { expectedRevision: s.revision, patch: { priority: 'LOW' } });
  const response = await request(app).post(`/api/sessions/${s.id}/generate`).send({ expectedRevision: s.revision, operation: 'prd-scope' }); expect(response.status).toBe(400); expect(response.body.error.message).toContain('Approve');
});
it('checks indirect input eligibility without mutating accepted content or breaking diagram reads', async () => {
  let s = await architectureBasis(); s = await generateAndAccept(repo, s, 'architecture');
  const runtime = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:runtime')!;
  const api = Object.values(s.artifactSections).find(a => a.sectionKey === 'ARCHITECTURE:api')!;
  const provider = altered(sections => { const db = sections.find(a => a.key === 'database')!; if (db.payload.kind === 'ArchitectureComponent') db.payload.purpose += ' Revised restore procedure.'; });
  const c = new DeliverableCommands(repo, provider); s = await c.generate(s.id, { expectedRevision: s.revision, operation: 'architecture' });
  const run = Object.values(s.generationRuns).at(-1)!; const db = proposals(s).find(a => a.sectionKey === 'ARCHITECTURE:database')!;
  s = await c.review(s.id, run.id, db.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(artifactEligible(s, s.artifactSections[runtime.id]!)).toBe(false);
  expect(artifactEligible(s, s.artifactSections[api.id]!)).toBe(false);
  // Phase 4 design §6/data-model §7: retain accepted bytes and historical review,
  // but mark the actual database consumer stale. The API is only a potential
  // transitive impact until an accepted runtime payload substantively changes.
  expect(s.artifactSections[runtime.id]).toEqual({ ...runtime, freshness: 'STALE', staleCauses: [{ kind: 'ArtifactSection', id: db.id }] });
  expect(s.artifactSections[api.id]).toEqual(api);
  const view = await c.read(s.id); expect(view.diagram.nodes.some(n => n.id === api.id)).toBe(false);
  const unsafe = new DeliverableCommands(repo, altered(sections => { const domain = sections.find(a => a.payload.kind === 'DataDomain')!; domain.dependencies.push(api.id); }));
  await expect(unsafe.generate(s.id, { expectedRevision: s.revision, operation: 'strategies' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
it('operation schemas reject missing strategy controls, invalid references and injected delivery totals', async () => {
  let s = await approvedSeed(repo, 'ai-enabled'); s = await generateAndAccept(repo, s, 'prd-scope'); s = await generateAndAccept(repo, s, 'architecture');
  const candidates = [...generateDataIntegrationStrategy(s), ...generateAIStrategy(s)];
  expect(phase2Schemas.strategies.safeParse({ sections: candidates }).success).toBe(true);
  const ai = candidates.find(a => a.payload.kind === 'AIUseCase')!;
  for (const field of ['evaluation', 'privacy', 'safety', 'humanReviewControls', 'deterministicAlternative']) {
    const broken = structuredClone(ai) as unknown as { payload: Record<string, unknown> }; delete broken.payload[field];
    expect(phase2Schemas.strategies.safeParse({ sections: [broken] }).success).toBe(false);
  }
  s = await generateAndAccept(repo, s, 'strategies');
  const delivery = generateDeliveryPlan(s); expect(phase2Schemas.delivery.safeParse({ sections: delivery }).success).toBe(true);
  for (const field of ['effort', 'personDays', 'ROM', 'timeline', 'confidence']) {
    const broken = structuredClone(delivery); Object.assign(broken[0]!.payload, { [field]: 10 });
    expect(phase2Schemas.delivery.safeParse({ sections: broken }).success).toBe(false);
  }
  for (const a of delivery) if (a.payload.kind === 'Workstream') { expect(a.payload.advisory!.suggestedRoles.length).toBeGreaterThan(0); expect(a.payload.advisory!.scopeRefs.length).toBeGreaterThan(0); expect(a.payload.advisory!.drivers.length).toBeGreaterThan(0); }
  const invalid = new DeliverableCommands(repo, altered(sections => { const domain = sections.find(a => a.payload.kind === 'DataDomain')!; if (domain.payload.kind === 'DataDomain') domain.payload.storageRefs = ['AS_99999']; }));
  await expect(invalid.generate(s.id, { expectedRevision: s.revision, operation: 'strategies' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
}, 30000);
it('enhancement remains a proposal until a human accepts and failed dependency acceptance changes nothing', async () => {
  let s = await approvedSeed(repo); const c = new DeliverableCommands(repo, altered(sections => { const cap = sections.find(a => a.payload.kind === 'Capability')!; if (cap.payload.kind === 'Capability') cap.payload.classification = 'ENHANCEMENT'; }));
  s = await c.generate(s.id, { expectedRevision: s.revision, operation: 'prd-scope' });
  const enhancement = proposals(s).find(a => a.payload.kind === 'Capability' && a.payload.classification === 'ENHANCEMENT')!;
  expect(s.artifactSections[enhancement.id]).toBeUndefined(); expect(scopeCoverage(s).covered).toBe(0);
  const run = Object.values(s.generationRuns).at(-1)!; s = await c.review(s.id, run.id, enhancement.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(s.artifactSections[enhancement.id]?.review).toBe('REVIEWED');
  s = await new DeliverableCommands(repo).generate(s.id, { expectedRevision: s.revision, operation: 'architecture' });
  const architecture = Object.values(s.generationRuns).at(-1)!; const dependent = proposals(s).find(a => a.sectionKey === 'ARCHITECTURE:runtime')!;
  const before = structuredClone(s); await expect(new DeliverableCommands(repo).review(s.id, architecture.id, dependent.id, { expectedRevision: s.revision, decision: 'ACCEPTED' })).rejects.toThrow('Accept dependency'); expect(await repo.load(s.id)).toEqual(before);
});
it('operational compare-and-save prevents a domain edit from losing a concurrent generation run', async () => {
  const s = await approvedSeed(repo); const stale = structuredClone(s); stale.revision++;
  await new DeliverableCommands(repo).generate(s.id, { expectedRevision: s.revision, operation: 'prd-scope' });
  await expect(repo.save(stale, s.revision)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(Object.values((await repo.load(s.id)).generationRuns).at(-1)?.schemaVersion).toBe('2');
});
