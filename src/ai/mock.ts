import { mockDeliverables } from '../generators/mock-deliverables.js';
import { Phase2OperationSchema } from '../domain/deliverables.js';
import type { ScopingSession } from '../domain/index.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AIProvider, ProviderRequest, ProviderResult } from './provider.js';
import { ProviderError } from '../application/errors.js';
import { sourceHash } from '../ingestion/sources.js';
import { SeedIdSchema } from '../seeds/schema.js';
import { mockRegeneration } from '../generators/mock-regeneration.js';
export class MockAIProvider implements AIProvider {
  constructor(private readonly fixtureDirectory?: string) {}
  async generate(request: ProviderRequest): Promise<ProviderResult> {
    if (request.signal?.aborted) throw new ProviderError('MOCK request was cancelled.');
    if (request.boundedContext) return { output: mockRegeneration(request), metadata: { provider: 'MockAIProvider', mode: 'MOCK', fixtureVariant: 'phase4-selective' } };
    if (Phase2OperationSchema.safeParse(request.operation).success && request.schemaVersion === '2' && request.requestedItemIds.length === 0) return { output: await mockDeliverables(structuredClone(request.context) as ScopingSession, Phase2OperationSchema.parse(request.operation)), metadata: { provider: 'MockAIProvider', mode: 'MOCK', fixtureVariant: 'phase2-seed' } };
    if (request.operation === 'analyze' && request.schemaVersion === '1' && request.fixtureVariant === 'scope' && request.requestedItemIds.length === 0) return this.analyze(request);
    if (request.operation !== 'analyze' || request.schemaVersion !== '1' || request.fixtureVariant !== 'foundation' || request.requestedItemIds.length > 0) throw new ProviderError();
    try {
      const output: unknown = JSON.parse(await readFile(resolve(this.fixtureDirectory ?? 'seeds/modernization', 'mock-foundation.json'), 'utf8'));
      if (request.signal?.aborted) throw new ProviderError('MOCK request was cancelled.');
      return { output, metadata: { provider: 'MockAIProvider', mode: 'MOCK', fixtureVariant: 'foundation' } };
    } catch (error) { if (error instanceof ProviderError) throw error; throw new ProviderError('Foundation fixture could not be read. Restore the checked-in fixture.'); }
  }
  private async analyze(request: ProviderRequest): Promise<ProviderResult> {
    const documents = request.context.activeSourceIds.map(id => request.context.documents[id]);
    if (documents.length !== 1 || !documents[0]) throw new ProviderError('Save one customer input before running MOCK analysis.');
    const document = documents[0];
    const directories = this.fixtureDirectory ? [{ id: 'custom', path: this.fixtureDirectory }] : SeedIdSchema.options.map(id => ({ id, path: resolve('seeds', id) }));
    for (const { id, path } of directories) {
      let raw: unknown;
      try { raw = JSON.parse(await readFile(resolve(path, 'mock-analysis.json'), 'utf8')); }
      catch { throw new ProviderError('A recorded scope fixture is unreadable. Restore the checked-in seed files.'); }
      // Only the recording envelope is trusted here. Its unknown analysis goes through
      // the common structural/source validators, including malformed fixture variants.
      const fixture = z.object({ fingerprint: z.string().min(1), analysis: z.unknown() }).strict().safeParse(raw);
      if (!fixture.success) throw new ProviderError('A recorded scope fixture has invalid fields. Restore the checked-in seed files.');
      if (fixture.data.fingerprint !== sourceHash(document.text)) continue;
      const bind = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(bind);
        if (typeof value !== 'object' || value === null) return value;
        const record = value as Record<string, unknown>;
        if (Object.hasOwn(record, 'sectionOrdinal')) {
          const { sectionOrdinal, ...citation } = record;
          return { ...citation, documentId: document.id, sectionId: typeof sectionOrdinal === 'number' ? document.sectionIds[sectionOrdinal] : undefined };
        }
        return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, bind(child)]));
      };
      if (request.signal?.aborted) throw new ProviderError('MOCK request was cancelled.');
      return { output: bind(fixture.data.analysis), metadata: { provider: 'MockAIProvider', mode: 'MOCK', fixtureVariant: `scope:${id}` } };
    }
    throw new ProviderError('This input is saved, but has no recorded MOCK analysis. Start a supported seed session to try analysis; your text and reviewed scope are preserved.');
  }
}
