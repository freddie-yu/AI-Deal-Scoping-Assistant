import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { EstimationCommands } from '../../src/application/estimation.js';
import { createApp } from '../../src/server/app.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { evaluateQuality } from '../../src/quality/index.js';
let directory: string, repo: JsonSessionRepository;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'phase4-impact-')); repo = new JsonSessionRepository(directory); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
it('expected-user change records an explicit provisional assumption without rewriting customer evidence', async () => {
  let s = await approvedSeed(repo); const scope = new ScopeCommands(repo);
  const r = Object.values(s.requirements).find(r => r.measures?.expectedUsers)!; const evidence = structuredClone(r.evidence); const doc = structuredClone(s.documents);
  s = await scope.changeExpectedUsers(s.id, r.id, { expectedRevision: s.revision, value: 500000, basis: 'Reviewer planning target for higher scale' });
  const next = s.requirements[r.id]!; const assumption = s.assumptions[next.assumptionIds.at(-1)!]!;
  expect(next).toMatchObject({ origin: 'ASSUMED', review: 'DRAFT', measures: { expectedUsers: { state: 'KNOWN', value: { value: 500000 } } } });
  expect(assumption).toMatchObject({ validation: 'PROVISIONAL', review: 'DRAFT', value: { kind: 'NUMBER', value: 500000 } });
  expect(next.evidence).toEqual(evidence.map(a => ({ ...a, relation: 'CONTEXT' }))); expect(s.documents).toEqual(doc);
  expect(s.lastImpact?.change?.changes.some(c => c.fields.includes('measures.expectedUsers.value.value'))).toBe(true);
});
it('scope edit persists exact diff and review-only reapproval rebases impact without staling preserved content', async () => {
  let s = await approvedSeed(repo); s = await generateAndAccept(repo, s, 'prd-scope'); s = await generateAndAccept(repo, s, 'architecture');
  const scope = new ScopeCommands(repo); const r = Object.values(s.requirements).find(r => r.type === 'FR')!;
  const arch = Object.values(s.artifactSections).filter(a => a.payload.kind === 'ArchitectureComponent');
  s = await scope.editRequirement(s.id, r.id, { expectedRevision: s.revision, patch: { priority: r.priority === 'HIGH' ? 'MEDIUM' : 'HIGH' } });
  expect(s.lastImpact?.change?.changes.find(c => c.node.kind === 'Requirement')?.fields).toEqual(['priority']);
  expect(arch.map(a => s.artifactSections[a.id])).toEqual(arch);
  s = await scope.review(s.id, 'requirements', r.id, { expectedRevision: s.revision }); s = await scope.approve(s.id, { expectedRevision: s.revision });
  expect(s.lastImpact?.evaluatedRevision).toBe(s.revision); expect(arch.map(a => s.artifactSections[a.id])).toEqual(arch);
  const response = await request(createApp(repo)).get(`/api/sessions/${s.id}/impact`).set('Host', 'localhost');
  expect(response.status).toBe(200); expect(response.body.current).toBe(true); expect(response.body.impact.changeId).toBe(s.lastImpact?.changeId);
}, 30000);
it('automatic rate recalculation retains an inspectable commercial-only impact and rejects obsolete requests', async () => {
  let s = await approvedSeed(repo); for (const op of ['prd-scope', 'architecture', 'strategies', 'delivery'] as const) s = await generateAndAccept(repo, s, op);
  const engine = new EstimationCommands(repo); s = await engine.prepare(s.id, { expectedRevision: s.revision }); s = await engine.review(s.id, { expectedRevision: s.revision, confirmed: true }); s = await engine.calculate(s.id, { expectedRevision: s.revision });
  const arch = Object.values(s.artifactSections).filter(a => a.payload.kind === 'ArchitectureComponent'); const rev = s.revision;
  s = await engine.configure(s.id, { expectedRevision: s.revision, confirmed: true, updates: [{ key: 'rates.E', value: { amount: 90000, currency: 'USD', unit: 'minor-units/person-day' }, basis: 'Reviewed changed rate' }] });
  expect(s.lastImpact?.direct.length).toBeGreaterThan(0); expect(s.lastImpact?.affectedSlices.every(a => !a.affected.includes('effort'))).toBe(true); expect(arch.map(a => s.artifactSections[a.id])).toEqual(arch);
  expect(s.lastImpact?.evaluatedRevision).toBe(s.revision);
  const response = await request(createApp(repo)).post(`/api/sessions/${s.id}/impact/recalculate`).set('Host', 'localhost').send({ expectedRevision: rev }); expect(response.status).toBe(409);
}, 30000);
it('flagship scale edit completes all connected stages and recalculation while preserving persona and core workflow', async () => {
  let s = await approvedSeed(repo); for (const op of ['prd-scope', 'architecture', 'strategies', 'delivery'] as const) s = await generateAndAccept(repo, s, op);
  const engine = new EstimationCommands(repo); s = await engine.prepare(s.id, { expectedRevision: s.revision }); s = await engine.review(s.id, { expectedRevision: s.revision, confirmed: true }); s = await engine.calculate(s.id, { expectedRevision: s.revision });
  const preserve = Object.values(s.artifactSections).filter(a => ['PRD:prd-personas', 'FUNCTIONAL_SCOPE:cap-fr-01'].includes(a.sectionKey)); const originalDocs = structuredClone(s.documents);
  const r = Object.values(s.requirements).find(r => r.measures?.expectedUsers)!; const scope = new ScopeCommands(repo);
  s = await scope.changeExpectedUsers(s.id, r.id, { expectedRevision: s.revision, value: 500000, basis: 'Reviewed higher-scale planning target' });
  const impact = structuredClone(s.lastImpact!);
  expect(impact.regenerationTargets.length).toBeGreaterThan(0); expect(impact.unaffectedReviewed.map(a => a.id)).toEqual(expect.arrayContaining(preserve.map(a => a.id)));
  for (const collection of ['requirements', 'assumptions'] as const) for (const a of Object.values(s[collection])) if (a.review !== 'REVIEWED') s = await scope.review(s.id, collection, a.id, { expectedRevision: s.revision });
  s = await scope.approve(s.id, { expectedRevision: s.revision });
  const commands = new DeliverableCommands(repo);
  for (let round = 0; round < 30 && s.lastImpact!.regenerationTargets.length; round++) {
    s = await commands.generateAffected(s.id, { expectedRevision: s.revision }); const run = Object.values(s.generationRuns).at(-1)!;
    for (const p of run.proposals) if (p.target.kind === 'ArtifactSection') s = await commands.review(s.id, run.id, p.target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  }
  expect(s.lastImpact!.regenerationTargets).toEqual([]);
  s = await engine.calculate(s.id, { expectedRevision: s.revision });
  expect(preserve.map(a => s.artifactSections[a.id])).toEqual(preserve); expect(s.documents).toEqual(originalDocs);
  expect(Object.values(s.artifactSections).filter(a => a.freshness === 'STALE')).toEqual([]);
  expect(evaluateQuality(s).issues.filter(i => i.type === 'COMMERCIAL_INCONSISTENCY')).toEqual([]);
}, 60000);
