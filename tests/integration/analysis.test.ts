import { expect, it } from 'vitest';
import { newSession } from '../../src/application/sessions.js';
import { addSource } from '../../src/ingestion/sources.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { validateProposal } from '../../src/validation/provider.js';

it('runs substantive seeded analysis through the provider rather than a canonical session fixture', async () => {
  const seed = await loadSeed('integration-heavy');
  expect(seed.phase).toBe('SCOPE');
  expect(seed.input).toBeDefined();
  const s = newSession({ customerName: 'C', opportunityName: 'O' });
  addSource(s, seed.input!);
  const result = await new MockAIProvider().generate({ operation: 'analyze', schemaVersion: '1', context: s, requestedItemIds: [], fixtureVariant: 'scope' });
  expect(result.metadata.mode).toBe('MOCK');
  expect(result.output).toMatchObject({ kind: 'Analysis' });
  expect(s.requirements).toEqual({});
});
