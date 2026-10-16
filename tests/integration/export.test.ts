import { beforeAll, afterAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { estimatedSeed } from '../helpers/package.js';
import { QualityCommands } from '../../src/application/quality.js';
import { ExportCommands } from '../../src/application/export.js';
import { renderPackage, DISCLAIMER, SECTION_TITLES } from '../../src/export/index.js';
import { evaluateQuality } from '../../src/quality/index.js';
import { createApp } from '../../src/server/app.js';
import type { ScopingSession } from '../../src/domain/index.js';
let dir: string, repo: JsonSessionRepository, base: ScopingSession;
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'export-')); repo = new JsonSessionRepository(dir); base = await estimatedSeed(repo); base = await new QualityCommands(repo).evaluate(base.id, { expectedRevision: base.revision }); }, 60000);
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
it('assembles 23 deterministic sections with exact disclaimer, current ledger, warnings, traceability and Mermaid fallback', () => {
  const p = renderPackage(base), again = renderPackage(structuredClone(base));
  expect(p.markdown).toBe(again.markdown); expect(p.sections.map(x => x.title)).toEqual(SECTION_TITLES);
  expect(p.markdown).toContain('This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.');
  expect(p.markdown.split(DISCLAIMER)).toHaveLength(2);
  for (const word of ['```mermaid', 'Component', 'Connection', 'FR_01', 'REVIEW_REQUIRED', 'MOCK', 'No reviewed controlled change']) expect(p.markdown).toContain(word);
  for (const q of Object.values(base.questions)) expect(p.markdown).toContain(q.question);
  expect(p.basis.sectionRevisions.length).toBeGreaterThan(0);
  const summary = Object.values(base.artifactSections).find(a => a.payload.kind === 'EstimateSummary')!;
  if (summary.payload.kind === 'EstimateSummary') expect(p.markdown).toContain(String(summary.payload.effort!.low));
}, 30000);
it('rejects REVIEW_REQUIRED without explicit acknowledgment, then exports identical preview bytes and immutable receipts', async () => {
  const c = new ExportCommands(repo), p = await c.preview(base.id);
  await expect(c.download(base.id, { expectedRevision: base.revision, snapshotHash: p.snapshotHash })).rejects.toThrow(/acknowledg/i);
  await c.acknowledge(base.id, { expectedRevision: base.revision, snapshotHash: p.snapshotHash, confirmed: true });
  const ready = await c.preview(base.id), result = await c.download(base.id, { expectedRevision: base.revision, snapshotHash: ready.snapshotHash });
  expect(result.markdown).toBe(ready.markdown);
  expect(result.receipt.fileHash).toBe(createHash('sha256').update(Buffer.from(result.markdown, 'utf8')).digest('hex'));
  const second = await c.download(base.id, { expectedRevision: base.revision, snapshotHash: ready.snapshotHash });
  expect(second.markdown).toBe(result.markdown); expect(second.receipt.id).not.toBe(result.receipt.id);
  expect((await repo.load(base.id)).exportReceipts).toEqual([result.receipt, second.receipt]);
  const app = createApp(repo);
  const http = await request(app).post('/api/sessions/' + base.id + '/package/export').set('Host', 'localhost').send({ expectedRevision: base.revision, snapshotHash: ready.snapshotHash });
  expect(http.status).toBe(200); expect(http.text).toBe(ready.markdown);
  expect(http.headers['x-content-sha256']).toBe(createHash('sha256').update(http.text, 'utf8').digest('hex'));
  expect(http.headers['content-disposition']).toMatch(/attachment; filename="[a-z0-9-]+\.md"/);
}, 30000);
it('rejects stale revision, findings, gate and preview authorization', async () => {
  const c = new ExportCommands(repo), p = await c.preview(base.id);
  await expect(c.download(base.id, { expectedRevision: base.revision - 1, snapshotHash: p.snapshotHash })).rejects.toThrow();
  await expect(c.download(base.id, { expectedRevision: base.revision, snapshotHash: '0'.repeat(64) })).rejects.toThrow();
  await new QualityCommands(repo).evaluate(base.id, { expectedRevision: base.revision, diagramRendered: false });
  await expect(c.download(base.id, { expectedRevision: base.revision, snapshotHash: p.snapshotHash })).rejects.toThrow();
  const blocked = await c.preview(base.id); expect(blocked.gate.status).toBe('BLOCKED');
  await expect(c.acknowledge(base.id, { expectedRevision: base.revision, snapshotHash: blocked.snapshotHash, confirmed: true })).rejects.toThrow(/block/i);
  await expect(c.download(base.id, { expectedRevision: base.revision, snapshotHash: blocked.snapshotHash })).rejects.toThrow(/block/i);
  const old = await repo.load(base.id); old.revision++; old.context.opportunityName = 'Later'; await repo.save(old, old.revision - 1);
  await expect(c.download(base.id, { expectedRevision: base.revision, snapshotHash: p.snapshotHash })).rejects.toThrow();
  expect((await repo.load(base.id)).exportReceipts!.length).toBe(3);
}, 30000);
it('never renders stale or unsupported accepted artifacts as current output', () => {
  const s = structuredClone(base), a = Object.values(s.artifactSections).find(a => a.payload.kind === 'ArchitectureComponent')!;
  a.freshness = 'STALE'; a.title = 'STALE_UNIQUE_CONTENT'; s.gate = evaluateQuality(s);
  expect(renderPackage(s).sections.find(x => x.title === 'Solution Architecture')!.body).not.toContain('STALE_UNIQUE_CONTENT');
  expect(renderPackage(s).gate.status).toBe('BLOCKED');
  a.freshness = 'CURRENT'; a.grounding = []; s.gate = evaluateQuality(s);
  expect(renderPackage(s).basis.sectionRevisions.some(x => x.id === a.id)).toBe(false);
}, 30000);
it('treats untrusted Markdown and HTML as inert text and sanitizes the filename', () => {
  const s = structuredClone(base); s.context.customerName = '../../CON/<script>alert(1)</script>![x](https://bad)'; s.context.opportunityName = '中文';
  const p = renderPackage(s);
  expect(p.filename).toMatch(/^[a-z0-9-]+\.md$/); expect(p.markdown).not.toContain('<script>');
  expect(p.markdown).not.toContain('![x]('); expect(p.markdown).toContain('&lt;script&gt;');
}, 30000);


