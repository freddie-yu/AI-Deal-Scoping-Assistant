import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { EstimationCommands } from '../../src/application/estimation.js';
import { estimateView, calculateEstimate } from '../../src/estimation/engine.js';
import { createApp } from '../../src/server/app.js';
vi.setConfig({ testTimeout: 60000 });
let dir: string, repo: JsonSessionRepository;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'phase3-')); repo = new JsonSessionRepository(dir); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
async function delivery(seed = 'integration-heavy') {
  let s = await approvedSeed(repo, seed);
  for (const op of ['prd-scope', 'architecture', 'strategies', 'delivery'] as const) s = await generateAndAccept(repo, s, op);
  return s;
}
it('prepares proposals, reviews, calculates, persists and reproduces ledger through explicit commands', async () => {
  let s = await delivery(); const commands = new EstimationCommands(repo);
  s = await commands.prepare(s.id, { expectedRevision: s.revision });
  expect(estimateView(s).units.some(a => a.review === 'PROPOSED')).toBe(true);
  s = await commands.review(s.id, { expectedRevision: s.revision, confirmed: true });
  s = await commands.calculate(s.id, { expectedRevision: s.revision });
  expect(estimateView(s).summary!.effort).not.toBeNull();
  const loaded = await repo.load(s.id); expect(loaded).toEqual(s);
  expect(estimateView(calculateEstimate(loaded, '2026-09-23T00:00:00Z')).items).toEqual(estimateView(s).items);
  const old = estimateView(s).summary!;
  s = await commands.configure(s.id, { expectedRevision: s.revision, confirmed: true, updates: [{ key: 'rates.E', value: { amount: 95000, currency: 'USD', unit: 'minor-units/person-day' }, basis: 'Reviewer rate' }] });
  expect(estimateView(s).summary!.effort).toEqual(old.effort); expect(estimateView(s).summary!.commercials.total).not.toEqual(old.commercials.total);
  await expect(commands.calculate(s.id, { expectedRevision: s.revision - 1 })).rejects.toThrow();
});
it('currency updates invalidate previous rates; missing rate leaves labor and limits ROM confidence', async () => {
  let s = await delivery(); const commands = new EstimationCommands(repo);
  s = await commands.prepare(s.id, { expectedRevision: s.revision }); s = await commands.review(s.id, { expectedRevision: s.revision, confirmed: true }); s = await commands.calculate(s.id, { expectedRevision: s.revision });
  const effort = estimateView(s).summary!.effort;
  s = await commands.configure(s.id, { expectedRevision: s.revision, confirmed: true, updates: [{ key: 'currency', value: { code: 'EUR', minorUnitDigits: 2 }, basis: 'New currency' }] });
  expect(s.configuration.entries['rates.E']!.validation).toBe('UNVALIDATED'); expect(estimateView(s).summary!.effort).toEqual(effort); expect(estimateView(s).summary!.commercials.total).toBeNull();
  const res = await request(createApp(repo)).get(`/api/sessions/${s.id}/estimate`).set('Host', 'localhost'); expect(res.status).toBe(200); expect(res.body.summary.commercials.total).toBeNull();
});
it('blocks calculation before approval and rejects invalid configuration without changing stored snapshot', async () => {
  let s = await delivery(); const commands = new EstimationCommands(repo);
  s = await commands.prepare(s.id, { expectedRevision: s.revision });
  const before = await repo.load(s.id);
  await expect(commands.configure(s.id, { expectedRevision: s.revision, confirmed: true, updates: [{ key: 'rates.E', value: { amount: 0, currency: 'USD', unit: 'minor-units/person-day' }, basis: 'Invalid' }] })).rejects.toThrow(); expect(await repo.load(s.id)).toEqual(before);
  s.scopeReviewFingerprint = null; s.revision++; await repo.save(s, before.revision);
  await expect(commands.calculate(s.id, { expectedRevision: s.revision })).rejects.toThrow(/Approve|scope/);
});

