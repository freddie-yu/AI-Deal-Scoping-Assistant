import type { ScopingSession } from '../domain/index.js';
import type { Phase2Operation } from '../domain/deliverables.js';
import { loadSeed } from '../seeds/loader.js';
import { SeedIdSchema } from '../seeds/schema.js';
import { ProviderError } from '../application/errors.js';
import { readFile } from 'node:fs/promises';
import { generatePRD, generateFunctionalScope } from './prd.js';
import { generateArchitecture } from './architecture.js';
import { generateDataIntegrationStrategy, generateAIStrategy } from './strategies.js';
import { generateDeliveryPlan } from './delivery.js';
export async function mockDeliverables(s: ScopingSession, operation: Phase2Operation) {
  // Documented parameterization: review, priority, inclusion and provisional/confirmed
  // assumption state. Changed free-form requirement meaning is not a supported recording.
  let supported = false;
  for (const id of SeedIdSchema.options) {
    const seed = await loadSeed(id);
    if (s.activeSourceIds.length !== 1 || s.documents[s.activeSourceIds[0]!]!.text !== seed.input?.text) continue;
    const fixture = JSON.parse(await readFile(`seeds/${id}/mock-analysis.json`, 'utf8')) as { analysis: { requirements: { description: string; type: string; origin: string; measures?: object; technologyConstraints?: object }[]; assumptions: { statement: string }[] } };
    const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE');
    supported = requirements.length === fixture.analysis.requirements.length && requirements.every(r => fixture.analysis.requirements.some(e => e.description === r.description && e.type === r.type && e.origin === r.origin && JSON.stringify(e.technologyConstraints ?? []) === JSON.stringify(r.technologyConstraints ?? []) && JSON.stringify(Object.entries(e.measures ?? {}).map(([k,v]) => [k, { state: v.state, value: v.value }])) === JSON.stringify(Object.entries(r.measures ?? {}).map(([k,v]) => [k, { state: v.state, value: v.state === 'KNOWN' ? v.value : undefined }])))) && Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE').every(a => fixture.analysis.assumptions.some(e => e.statement === a.statement));
  }
  if (!supported) throw new ProviderError('No supported Phase 2 MOCK variant for this scope. The four seed recordings allow review, priority and inclusion edits; changed requirement/assumption meaning needs a new fixture. Existing work is preserved.');
  try {
    return { sections: operation === 'prd-scope' ? [...generatePRD(s), ...generateFunctionalScope(s)] : operation === 'architecture' ? generateArchitecture(s) : operation === 'strategies' ? [...generateDataIntegrationStrategy(s), ...generateAIStrategy(s)] : generateDeliveryPlan(s) };
  } catch (error) { throw new ProviderError(error instanceof Error ? error.message : 'MOCK generation failed.'); }
}
