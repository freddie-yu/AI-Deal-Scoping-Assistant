import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { assertPhase2Goldens } from '../helpers/phase2-goldens.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { ArtifactSectionSchema, type ScopingSession } from '../../src/domain/index.js';
let directory: string; let repo: JsonSessionRepository;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'p2-semantic-')); repo = new JsonSessionRepository(directory); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
async function complete(seed: string) { let s = await approvedSeed(repo, seed); for (const operation of ['prd-scope', 'architecture', 'strategies'] as const) s = await generateAndAccept(repo, s, operation); return s; }
function assertShapes(s: ScopingSession) { for (const a of Object.values(s.artifactSections)) expect(ArtifactSectionSchema.safeParse(a).success).toBe(true); }
it.each(['modernization', 'integration-heavy', 'ai-enabled', 'missing-information'])('seed satisfies structured Phase 2 semantic goldens: %s', async id => { assertPhase2Goldens(await complete(id), await loadSeed(id)); }, 30000);
it('missing expected capability and unsupported additional capability fail despite valid shapes', async () => {
  const s = await complete('modernization'); const seed = await loadSeed('modernization');
  const missing = structuredClone(s); const cap = Object.values(missing.artifactSections).find(a => a.payload.kind === 'Capability' && a.payload.requirementIds.includes('FR_01'))!; delete missing.artifactSections[cap.id];
  assertShapes(missing); expect(() => assertPhase2Goldens(missing, seed)).toThrow();
  const unsupported = structuredClone(s); const extra = structuredClone(cap); extra.id = 'AS_999'; extra.grounding = []; unsupported.artifactSections[extra.id] = extra;
  assertShapes(unsupported); expect(() => assertPhase2Goldens(unsupported, seed)).toThrow();
}, 30000);
it('Salesforce mapped to unrelated integration fails semantic acceptance', async () => {
  const s = await complete('integration-heavy'); const section = Object.values(s.artifactSections).find(a => a.payload.kind === 'Integration' && a.payload.name === 'Salesforce')!;
  if (section.payload.kind === 'Integration') { section.payload.name = 'HubSpot'; section.payload.endpoints.forEach(e => { if (e.kind === 'EXTERNAL_SYSTEM') e.name = 'HubSpot'; }); }
  assertShapes(s); const seed = await loadSeed('integration-heavy'); expect(() => assertPhase2Goldens(s, seed)).toThrow();
}, 30000);
it('PostgreSQL violation fails semantic acceptance', async () => {
  const s = await complete('modernization'); const a = Object.values(s.artifactSections).find(a => a.payload.kind === 'ArchitectureComponent' && a.payload.catalogServiceKey === 'aws:rds-postgresql')!;
  if (a.payload.kind === 'ArchitectureComponent') a.payload.catalogServiceKey = 'aws:s3';
  a.technologyChoices = [{ key: 'db', target: 'DATABASE', technologyKey: { state: 'KNOWN', value: 'aws:s3' } }];
  assertShapes(s); const seed = await loadSeed('modernization'); expect(() => assertPhase2Goldens(s, seed)).toThrow();
}, 30000);
it('AI without mandatory review and AI linked to unrelated requirements fail independently', async () => {
  const s = await complete('ai-enabled'); const seed = await loadSeed('ai-enabled');
  const ai = Object.values(s.artifactSections).find(a => a.payload.kind === 'AIUseCase')!;
  const noReview = structuredClone(s); const payload = noReview.artifactSections[ai.id]!.payload;
  if (payload.kind === 'AIUseCase') payload.humanReviewControls = { state: 'NOT_APPLICABLE', reason: 'Autonomous sending.' };
  assertShapes(noReview); expect(() => assertPhase2Goldens(noReview, seed)).toThrow();
  const unrelated = structuredClone(s); const changed = unrelated.artifactSections[ai.id]!;
  changed.grounding = [{ source: { kind: 'Requirement', id: 'SEC_01' }, reviewedRevision: 1, rationale: 'Unrelated existing ID is not sufficient.' }];
  if (changed.payload.kind === 'AIUseCase') changed.payload.aiRequirementIds = ['SEC_01'];
  assertShapes(unrelated); expect(() => assertPhase2Goldens(unrelated, seed)).toThrow();
}, 30000);
it('invented specific concurrency fails semantic acceptance', async () => {
  const s = await complete('missing-information'); const a = Object.values(s.artifactSections).find(a => a.payload.kind === 'Narrative' && a.payload.topic === 'SCALABILITY')!;
  a.applicability = { state: 'KNOWN', value: 'Customer has 200 concurrent users.' }; if (a.payload.kind === 'Narrative') a.payload.paragraphs[0]!.text = 'Support 200 concurrent users.';
  assertShapes(s); const seed = await loadSeed('missing-information'); expect(() => assertPhase2Goldens(s, seed)).toThrow();
}, 30000);
