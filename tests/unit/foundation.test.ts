import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ScopingSessionSchema, RequirementSchema, RangeSchema, EstimationUnitPayloadSchema, ConfigurationSchema } from '../../src/domain/index.js';
import { newSession } from '../../src/application/sessions.js';
import { MockAIProvider } from '../../src/ai/mock.js';
import { validateProposal, FoundationProposalSchema } from '../../src/validation/provider.js';
import { loadSeed } from '../../src/seeds/loader.js';

describe('foundation contracts', () => {
  it('round trips a complete empty aggregate without losing fields', () => {
    const session = newSession({ customerName: 'Customer', opportunityName: 'Foundation' });
    expect(ScopingSessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(session);
    expect(ScopingSessionSchema.safeParse({ ...session, id: '../escape' }).success).toBe(false);
    expect(ScopingSessionSchema.safeParse({ ...session, configuration: {} }).success).toBe(false);
  });
  it('requires anchored requirements and preserves review independently of freshness', () => {
    expect(RequirementSchema.safeParse({ id: 'FR_01', type: 'FR', description: 'unsupported' }).success).toBe(false);
  });
  it('rejects nonfinite/reversed ranges and invalid configuration values', () => {
    expect(RangeSchema.safeParse({ low: 2, high: 1, unit: 'person-days' }).success).toBe(false);
    expect(RangeSchema.safeParse({ low: 1, high: Infinity, unit: 'person-days' }).success).toBe(false);
    expect(ConfigurationSchema.safeParse({ id: 'CFG_01', revision: 1, entries: { productivity: { key: 'productivity', revision: 1, basis: 'test', origin: 'ASSUMED', validation: 'VALIDATED', kind: 'VALUE', value: { state: 'KNOWN', value: -1 } } } }).success).toBe(false);
  });
  it('rejects batch quantities and invalid canonical source pairings', () => {
    expect(EstimationUnitPayloadSchema.safeParse({ kind: 'EstimationUnit', unitType: 'INTEGRATION', quantity: { state: 'KNOWN', value: 3 }, source: { kind: 'SOLUTION', sessionId: randomUUID() } }).success).toBe(false);
  });
  it('loads seed manifests through a shared schema', async () => {
    expect((await loadSeed('modernization')).id).toBe('modernization');
    await expect(loadSeed('../escape')).rejects.toThrow();
  });
  it('passes unknown mock output through structural validation and semantic hooks', async () => {
    const session = newSession({ customerName: 'Example', opportunityName: 'Foundation' });
    const request = { operation: 'analyze' as const, context: session, schemaVersion: '1', requestedItemIds: [], fixtureVariant: 'foundation' };
    const result = await new MockAIProvider().generate(request);
    let checked = false;
    const proposal = await validateProposal(result, FoundationProposalSchema, [() => { checked = true; }]);
    expect(checked).toBe(true);
    expect(proposal.metadata.mode).toBe('MOCK');
    expect(proposal.proposal.kind).toBe('Foundation');
    expect(session.requirements).toEqual({});
    await expect(validateProposal({ ...result, output: { kind: 'Foundation', message: 42 } }, FoundationProposalSchema)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
