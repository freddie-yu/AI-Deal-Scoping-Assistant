import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { newSession } from '../../src/application/sessions.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import type { AIProvider } from '../../src/ai/provider.js';
import type { ScopingSession } from '../../src/domain/index.js';
import { loadSeed } from '../../src/seeds/loader.js';

let directory: string; let repo: JsonSessionRepository; let commands: ScopeCommands; let session: ScopingSession;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'scope-commands-')); repo = new JsonSessionRepository(directory); commands = new ScopeCommands(repo); session = newSession({ customerName: 'Customer', opportunityName: 'Review' }); await repo.create(session); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
async function analyze(seedId = 'modernization') { const seed = await loadSeed(seedId); session = await commands.saveInput(session.id, { expectedRevision: session.revision, ...seed.input }); session = await commands.analyze(session.id, { expectedRevision: session.revision }); return session; }
async function reviewAll() {
  for (const kind of ['requirements', 'assumptions', 'questions'] as const) for (const record of Object.values(session[kind]).filter(r => r.lifecycle === 'ACTIVE')) session = await commands.review(session.id, kind, record.id, { expectedRevision: session.revision });
}
it('canonicalizes all six type namespaces and preserves sources, provenance and draft review', async () => {
  await analyze(); const first = session;
  expect(Object.keys(first.requirements)).toEqual(['BR_01', 'FR_01', 'DATA_01', 'NFR_01', 'SEC_01', 'NFR_02']);
  expect(first.requirements.NFR_02).toMatchObject({ review: 'DRAFT', origin: 'AI_INFERRED', evidence: [{ relation: 'CONTEXT' }] });
  await analyze('integration-heavy');
  expect(session.requirements.INT_01?.description).toBe('Existing CRM is Salesforce.');
  expect(session.requirements.BR_02).toBeDefined(); expect(session.requirements.BR_01?.lifecycle).toBe('RETIRED');
  expect(session.generationRuns.RUN_02?.mode).toBe('MOCK');
});
it('requires deliberate item review before approval, then persists approval and exact evidence', async () => {
  await analyze(); await expect(commands.approve(session.id, { expectedRevision: session.revision })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect((await commands.readScope(session.id)).eligibility.eligible).toBe(false);
  await reviewAll(); expect((await commands.readScope(session.id)).status).toBe('READY_FOR_REVIEW');
  session = await commands.approve(session.id, { expectedRevision: session.revision });
  expect((await commands.readScope(session.id)).eligibility.eligible).toBe(true);
  expect((await commands.readScope(session.id)).warnings.join(' ')).toContain('Q_01');
  expect(await repo.load(session.id)).toEqual(session);
  expect(session.assumptions.ASM_01?.validation).toBe('PROVISIONAL'); expect(session.questions.Q_01?.status).toBe('OPEN');
});
it('normal edits retain identity, advance revision and remove current approval without changing downstream sections', async () => {
  await analyze(); await reviewAll(); session = await commands.approve(session.id, { expectedRevision: session.revision });
  const sections = structuredClone(session.artifactSections); const before = session.requirements.FR_01!;
  session = await commands.editRequirement(session.id, before.id, { expectedRevision: session.revision, patch: { priority: 'HIGH' } });
  expect(session.requirements.FR_01).toMatchObject({ id: before.id, revision: before.revision + 1, review: 'DRAFT' });
  expect(session.scopeReviewFingerprint).toBeNull(); expect(session.artifactSections).toEqual(sections);
  expect(session.pendingChanges?.length).toBe(1);
});
it('rejects unsupported customer-stated edits and permits explicit contextual inference', async () => {
  await analyze(); const revision = session.revision;
  await expect(commands.editRequirement(session.id, 'FR_01', { expectedRevision: revision, patch: { description: 'Support cryptocurrency payments.' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect((await repo.load(session.id)).revision).toBe(revision);
  session = await commands.editRequirement(session.id, 'FR_01', { expectedRevision: revision, patch: { description: 'Provide a review queue for order exceptions.', origin: 'AI_INFERRED', basis: 'Human interpretation of the order workflow.' } });
  expect(session.requirements.FR_01?.evidence[0]?.relation).toBe('CONTEXT');
});
it('type correction retires the old namespace and creates an explicit linked replacement', async () => {
  await analyze(); session = await commands.editRequirement(session.id, 'FR_01', { expectedRevision: session.revision, patch: { type: 'BR' } });
  expect(session.requirements.FR_01?.lifecycle).toBe('RETIRED'); expect(session.requirements.BR_02?.supersedesId).toBe('FR_01');
  expect(session.requirements.BR_02?.review).toBe('DRAFT');
});
it('requires exclusion reasons and confirmation notes and keeps answer changes explicit', async () => {
  await analyze();
  await expect(commands.editRequirement(session.id, 'FR_01', { expectedRevision: session.revision, patch: { inclusion: 'EXCLUDED' } })).rejects.toThrow();
  await expect(commands.editAssumption(session.id, 'ASM_01', { expectedRevision: session.revision, patch: { validation: 'CONFIRMED' } })).rejects.toThrow();
  session = await commands.editAssumption(session.id, 'ASM_01', { expectedRevision: session.revision, patch: { validation: 'CONFIRMED', confirmation: { note: 'Confirmed by the customer in discovery.', evidence: [] } } });
  const requirements = structuredClone(session.requirements);
  session = await commands.answerQuestion(session.id, 'Q_01', { expectedRevision: session.revision, answer: { text: 'Peak concurrency is 200.', basis: 'Customer discovery meeting.', evidence: [] } });
  expect(session.requirements).toEqual(requirements); expect(session.questions.Q_01).toMatchObject({ status: 'ANSWERED', review: 'DRAFT' });
});
it('replacing input preserves old anchors and forces re-review; unsupported mock text cannot erase scope', async () => {
  await analyze(); await reviewAll(); const old = structuredClone(session.documents); const evidence = structuredClone(session.requirements.FR_01?.evidence);
  session = await commands.saveInput(session.id, { expectedRevision: session.revision, title: 'Replacement', text: 'Arbitrary new customer requirements.', inputKind: 'PASTED_TEXT' });
  expect(session.documents.DOC_01).toEqual(old.DOC_01); expect(session.requirements.FR_01?.evidence).toEqual(evidence); expect(session.requirements.FR_01?.review).toBe('DRAFT');
  await expect(commands.analyze(session.id, { expectedRevision: session.revision })).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  expect(await repo.load(session.id)).toEqual(session);
});
it('a stale captured provider result cannot overwrite a newer source revision', async () => {
  const seed = await loadSeed('modernization'); session = await commands.saveInput(session.id, { expectedRevision: session.revision, ...seed.input });
  let release!: () => void; let started!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; }); const entered = new Promise<void>(resolve => { started = resolve; });
  const provider: AIProvider = { async generate(request) { started(); await barrier; return new MockAIProvider().generate(request); } };
  const slow = new ScopeCommands(repo, provider).analyze(session.id, { expectedRevision: session.revision });
  const rejection = expect(slow).rejects.toMatchObject({ code: 'CONFLICT' });
  await entered; session = await commands.saveInput(session.id, { expectedRevision: session.revision, title: 'New source', text: 'Changed while analysis was running.', inputKind: 'PASTED_TEXT' }); release();
  await rejection; expect(await repo.load(session.id)).toEqual(session);
});
it('structured fact edits cannot retain unsupported customer-stated provenance', async () => {
  await analyze();
  await expect(commands.editRequirement(session.id, 'NFR_01', { expectedRevision: session.revision, patch: { measures: { expectedUsers: { state: 'KNOWN', value: { value: 500000, unit: 'registered users' } } } } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(commands.editRequirement(session.id, 'DATA_01', { expectedRevision: session.revision, patch: { technologyConstraints: [{ key: 'postgresql', target: 'DATABASE', strength: 'MUST', kind: 'PROHIBITED_TECHNOLOGY', values: ['postgresql'] }] } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
it('changed assumptions cannot reuse old confirmation or silently override UNVALIDATED', async () => {
  await analyze(); const confirmation = { note: 'Customer confirmed availability in discovery.', evidence: [] };
  session = await commands.editAssumption(session.id, 'ASM_01', { expectedRevision: session.revision, patch: { validation: 'CONFIRMED', confirmation } });
  await expect(commands.editAssumption(session.id, 'ASM_01', { expectedRevision: session.revision, patch: { statement: 'The customer accepts a new delivery deadline.', validation: 'CONFIRMED', confirmation } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  session = await commands.editAssumption(session.id, 'ASM_01', { expectedRevision: session.revision, patch: { statement: 'A different representative might attend.', validation: 'UNVALIDATED' } });
  expect(session.assumptions.ASM_01!.validation).toBe('UNVALIDATED'); expect(session.assumptions.ASM_01!.confirmation).toBeUndefined();
  await expect(commands.review(session.id, 'assumptions', 'ASM_01', { expectedRevision: session.revision })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
it('cannot launder changed structured claims back to customer-stated through a second edit', async () => {
  await analyze(); const evidence = structuredClone(session.requirements.DATA_01!.evidence);
  session = await commands.editRequirement(session.id, 'DATA_01', { expectedRevision: session.revision, patch: { origin: 'AI_INFERRED', basis: 'Proposed change pending customer confirmation.', technologyConstraints: [{ key: 'postgresql', target: 'DATABASE', strength: 'MUST', kind: 'PROHIBITED_TECHNOLOGY', values: ['postgresql'] }] } });
  await expect(commands.editRequirement(session.id, 'DATA_01', { expectedRevision: session.revision, patch: { origin: 'CUSTOMER_STATED', evidence } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
