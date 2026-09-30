import { expect, it } from 'vitest';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newSession } from '../../src/application/sessions.js';
import { addSource } from '../../src/ingestion/sources.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import { AnalysisProposalSchema } from '../../src/domain/analysis.js';
import { validateProposal } from '../../src/validation/provider.js';
import { validateAnalysis } from '../../src/validation/analysis.js';
const malformed: { name: string; field: string; value: unknown }[] = JSON.parse(await readFile('tests/fixtures/malformed-analysis.json', 'utf8'));
for (const fixture of malformed) it(`rejects ${fixture.name} before canonicalization`, async () => {
  const s = newSession({ customerName: 'C', opportunityName: 'O' }); addSource(s, (await loadSeed('integration-heavy')).input!);
  const before = structuredClone(s);
  const result = await new MockAIProvider().generate({ operation: 'analyze', schemaVersion: '1', context: s, requestedItemIds: [], fixtureVariant: 'scope' });
  const output = AnalysisProposalSchema.parse(result.output); const path = fixture.field.split('.');
  let target = output.requirements[0] as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[path.at(-1)!] = fixture.value;
  await expect(validateProposal({ ...result, output }, AnalysisProposalSchema, [p => validateAnalysis(s, p)])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(s).toEqual(before);
});
it('returns malformed on-disk scope output to the shared validator with field paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'malformed-scope-'));
  try {
    const fixture = JSON.parse(await readFile('seeds/modernization/mock-analysis.json', 'utf8'));
    fixture.analysis.requirements[0].type = 'INVALID'; await writeFile(join(directory, 'mock-analysis.json'), JSON.stringify(fixture));
    const s = newSession({ customerName: 'C', opportunityName: 'O' }); addSource(s, (await loadSeed('modernization')).input!);
    const result = await new MockAIProvider(directory).generate({ operation: 'analyze', context: s, schemaVersion: '1', requestedItemIds: [], fixtureVariant: 'scope' });
    await expect(validateProposal(result, AnalysisProposalSchema)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', paths: ['requirements.0.type'] });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it('rejects invented structured numbers in a direct customer-stated extraction', async () => {
  const s = newSession({ customerName: 'C', opportunityName: 'O' }); addSource(s, (await loadSeed('modernization')).input!);
  const result = await new MockAIProvider().generate({ operation: 'analyze', context: s, schemaVersion: '1', requestedItemIds: [], fixtureVariant: 'scope' });
  const output = AnalysisProposalSchema.parse(result.output); output.requirements[3]!.measures = { expectedUsers: { state: 'KNOWN', value: { value: 500000, unit: 'registered users' } } };
  await expect(validateProposal({ ...result, output }, AnalysisProposalSchema, [p => validateAnalysis(s, p)])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
