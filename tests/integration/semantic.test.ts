import { expect, it } from 'vitest';
import { newSession } from '../../src/application/sessions.js';
import { addSource, exactExcerpt } from '../../src/ingestion/sources.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { validateProposal } from '../../src/validation/provider.js';
import { validateAnalysis } from '../../src/validation/analysis.js';
import { AnalysisProposalSchema } from '../../src/domain/analysis.js';
import { ScopingSessionSchema } from '../../src/domain/index.js';
import { canonicalizeAnalysis } from '../../src/application/canonicalize.js';
import { assertSemanticGoldens } from '../helpers/semantic-goldens.js';
import { readFile } from 'node:fs/promises';
import { ScopeFixtureSchema } from '../../src/seeds/scope-fixture.js';
async function analyzed(id: string) {
  ScopeFixtureSchema.parse(JSON.parse(await readFile(`seeds/${id}/mock-analysis.json`, 'utf8')));
  const seed = await loadSeed(id); const s = newSession({ customerName: 'C', opportunityName: 'O' }); addSource(s, seed.input!);
  const result = await new MockAIProvider().generate({ operation: 'analyze', context: s, schemaVersion: '1', requestedItemIds: [], fixtureVariant: 'scope' });
  const validated = await validateProposal(result, AnalysisProposalSchema, [p => validateAnalysis(s, p)]); canonicalizeAnalysis(s, validated.proposal, validated.metadata);
  return { s: ScopingSessionSchema.parse(s), seed };
}
for (const seedId of ['modernization', 'integration-heavy', 'ai-enabled', 'missing-information']) it(`${seedId} passes structured facts, provenance, uncertainty and exact evidence goldens`, async () => {
  const { s, seed } = await analyzed(seedId); assertSemanticGoldens(s, seed);
  for (const r of Object.values(s.requirements)) for (const anchor of r.evidence) expect(exactExcerpt(s, anchor)).toBe(s.documents[anchor.documentId]!.text.slice(anchor.start, anchor.end));
  if (seedId === 'modernization') {
    expect(s.requirements.DATA_01!.technologyConstraints?.[0]).toMatchObject({ kind: 'DATABASE_COMPATIBILITY', values: ['postgresql'], strength: 'MUST' });
    expect(s.requirements.NFR_01!.measures?.expectedUsers).toMatchObject({ state: 'KNOWN', value: { value: 5000 } });
  }
  if (seedId === 'missing-information') { expect(Object.values(s.questions).map(q => q.subject)).toEqual(['concurrency', 'apiReadiness', 'rate']); expect(s.requirements.FR_01?.origin).toBe('ASSUMED'); }
});
it('rejects shape-valid HubSpot substitution for the source-stated Salesforce fact', async () => {
  const { s, seed } = await analyzed('integration-heavy');
  for (const section of Object.values(s.artifactSections)) if (section.payload.kind === 'Narrative') for (const fact of section.payload.facts ?? []) if (fact.subject === 'existingCRM') fact.value = 'HubSpot';
  expect(ScopingSessionSchema.safeParse(s).success).toBe(true); expect(() => assertSemanticGoldens(s, seed)).toThrow();
});
it('rejects correct CRM value attached to the wrong requirement or classification', async () => {
  const { s, seed } = await analyzed('integration-heavy');
  const wrongOrigin = structuredClone(s); wrongOrigin.requirements.INT_01!.origin = 'AI_INFERRED';
  expect(ScopingSessionSchema.safeParse(wrongOrigin).success).toBe(true); expect(() => assertSemanticGoldens(wrongOrigin, seed)).toThrow();
  const wrongLink = structuredClone(s);
  for (const section of Object.values(wrongLink.artifactSections)) if (section.payload.kind === 'Narrative') for (const fact of section.payload.facts ?? []) if (fact.subject === 'existingCRM') fact.requirementIds = ['BR_01'];
  expect(ScopingSessionSchema.safeParse(wrongLink).success).toBe(true); expect(() => assertSemanticGoldens(wrongLink, seed)).toThrow();
});
it('rejects invented concurrency and missing linked questions even when schemas accept them', async () => {
  const { s, seed } = await analyzed('missing-information'); const r = Object.values(s.requirements).find(r => r.measures?.concurrency)!;
  r.measures!.concurrency = { state: 'KNOWN', value: { value: 1000, unit: 'concurrent users' } };
  expect(ScopingSessionSchema.safeParse(s).success).toBe(true); expect(() => assertSemanticGoldens(s, seed)).toThrow();
  const valid = await analyzed('missing-information'); delete valid.s.questions.Q_01;
  expect(ScopingSessionSchema.safeParse(valid.s).success).toBe(true); expect(() => assertSemanticGoldens(valid.s, valid.seed)).toThrow();
});
