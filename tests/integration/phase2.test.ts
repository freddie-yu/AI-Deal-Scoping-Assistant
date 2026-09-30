import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { SessionCommands } from '../../src/application/sessions.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { PRD_TOPICS } from '../../src/domain/deliverables.js';
import { scopeCoverage } from '../../src/traceability/coverage.js';
let directory: string; let repo: JsonSessionRepository;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'phase2-')); repo = new JsonSessionRepository(directory); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
it('requires approval for every operation and has no empty-denominator coverage claim', async () => {
  const s = await new SessionCommands(repo).createSeed({ seedId: 'modernization' });
  for (const operation of ['prd-scope', 'architecture', 'strategies', 'delivery']) await expect(new DeliverableCommands(repo).generate(s.id, { expectedRevision: s.revision, operation })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(scopeCoverage(s).percentage).toBeNull();
});
it.each(['modernization', 'integration-heavy', 'ai-enabled', 'missing-information'])('generates connected reviewable artifacts and persists each accepted section: %s', async seed => {
  let s = await approvedSeed(repo, seed); const commands = new DeliverableCommands(repo); const revision = s.revision;
  s = await commands.generate(s.id, { expectedRevision: s.revision, operation: 'prd-scope' });
  expect(s.revision).toBe(revision); expect(scopeCoverage(s).covered).toBe(0);
  const run = Object.values(s.generationRuns).at(-1)!;
  for (const topic of PRD_TOPICS) expect(run.proposals.some(p => p.action !== 'RETIRE' && p.candidate.kind === 'ArtifactSection' && p.candidate.record.payload.kind === 'Narrative' && p.candidate.record.payload.topic === topic)).toBe(true);
  for (const p of run.proposals) if ('id' in p.target) s = await commands.review(s.id, run.id, p.target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  expect(scopeCoverage(s).percentage).toBe(100);
  s = await generateAndAccept(repo, s, 'architecture');
  s = await generateAndAccept(repo, s, 'strategies');
  s = await generateAndAccept(repo, s, 'delivery');
  expect(await repo.load(s.id)).toEqual(s);
  const view = await commands.read(s.id); expect(view.diagram.nodes.length).toBeGreaterThan(0); expect(view.diagram.edges.length).toBeGreaterThan(0);
  expect(Object.values(s.artifactSections).some(a => a.payload.kind === 'Workstream')).toBe(true);
  expect(Object.values(s.artifactSections).some(a => a.payload.kind === 'EstimateItem' || a.payload.kind === 'EstimationUnit')).toBe(false);
}, 30000);
it('rejects stale proposals after scope edits and preserves accepted sections', async () => {
  let s = await approvedSeed(repo); s = await generateAndAccept(repo, s, 'prd-scope');
  const before = structuredClone(s.artifactSections); const c = new DeliverableCommands(repo);
  s = await c.generate(s.id, { expectedRevision: s.revision, operation: 'architecture' }); const run = Object.values(s.generationRuns).at(-1)!;
  s = await new ScopeCommands(repo).editRequirement(s.id, 'FR_01', { expectedRevision: s.revision, patch: { priority: 'LOW' } });
  await expect(c.review(s.id, run.id, run.proposals[0]!.target.kind === 'ArtifactSection' ? run.proposals[0]!.target.id : '', { expectedRevision: s.revision, decision: 'ACCEPTED' })).rejects.toMatchObject({ code: 'CONFLICT' });
  // Phase 4 adds substantive freshness; proposal rejection still preserves all
  // accepted content and historical review while only the priority consumer stales.
  for (const [id, section] of Object.entries(before)) {
    if (section.payload.kind === 'Capability' && section.payload.requirementIds.includes('FR_01')) {
      expect(s.artifactSections[id]).toEqual({ ...section, freshness: 'STALE', staleCauses: [{ kind: 'Requirement', id: 'FR_01' }] });
    } else expect(s.artifactSections[id]).toEqual(section);
  }
});
