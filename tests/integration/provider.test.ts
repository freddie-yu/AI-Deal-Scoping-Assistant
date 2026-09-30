import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockAIProvider } from '../../src/ai/mock.js';
import { validateProposal, FoundationProposalSchema } from '../../src/validation/provider.js';
import { newSession } from '../../src/application/sessions.js';
it('rejects a malformed on-disk mock fixture through the shared validation path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scoping-provider-'));
  try {
    await writeFile(join(directory, 'mock-foundation.json'), JSON.stringify({ kind: 'Foundation', message: 42, capabilities: [] }));
    const context = newSession({ customerName: 'Fixture', opportunityName: 'Validation' });
    const before = JSON.stringify(context);
    const output = await new MockAIProvider(directory).generate({ operation: 'analyze', schemaVersion: '1', context, requestedItemIds: [], fixtureVariant: 'foundation' });
    await expect(validateProposal(output, FoundationProposalSchema)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', paths: ['message'] });
    expect(JSON.stringify(context)).toBe(before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it('rejects unsupported and cancelled provider requests without state changes', async () => {
  const context = newSession({ customerName: 'Fixture', opportunityName: 'Boundaries' });
  const request = { operation: 'architecture' as const, schemaVersion: '1', context, requestedItemIds: [] };
  await expect(new MockAIProvider().generate(request)).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  const controller = new AbortController(); controller.abort();
  await expect(new MockAIProvider().generate({ ...request, signal: controller.signal })).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
});
