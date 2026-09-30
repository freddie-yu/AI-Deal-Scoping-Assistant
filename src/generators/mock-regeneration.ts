import type { ScopingSession } from '../domain/index.js';
import type { SectionCandidate } from '../domain/deliverables.js';
import type { ProviderRequest } from '../ai/provider.js';
import { ProviderError } from '../application/errors.js';
import { loadSeed } from '../seeds/loader.js';
import { readFile } from 'node:fs/promises';

// Finite, documented recording extensions. No free-form edit is represented as
// an AI interpretation. Validation happens in the application before projection.
export async function validateRegenerationFixture(s: ScopingSession) {
  const seed = await loadSeed(s.seedId ?? '');
  if (s.activeSourceIds.length !== 1 || s.documents[s.activeSourceIds[0]!]!.text !== seed.input?.text) throw new ProviderError('Selective MOCK regeneration requires an unchanged supported seed source.');
  const fixture = JSON.parse(await readFile(`seeds/${seed.id}/mock-analysis.json`, 'utf8')) as { analysis: { requirements: { description: string; type: string; origin: string; measures?: Record<string, { state: string; value?: unknown }>; technologyConstraints?: unknown[] }[]; assumptions: { statement: string }[] } };
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE');
  const supported = requirements.length === fixture.analysis.requirements.length && requirements.every(r => {
    const original = fixture.analysis.requirements.find(f => f.type === r.type && (f.description === r.description || seed.id === 'modernization' && f.description === 'Support 5,000 registered users.' && r.description === 'Support 500,000 registered users.' || seed.id === 'ai-enabled' && f.description === 'A support agent must approve every reply before it is sent.' && r.description === 'A support agent and supervisor must approve every reply before it is sent.'));
    if (!original || JSON.stringify(original.technologyConstraints ?? []) !== JSON.stringify(r.technologyConstraints ?? [])) return false;
    const scale = seed.id === 'modernization' && original.measures?.expectedUsers && r.measures?.expectedUsers?.state === 'KNOWN' && [5000, 500000].includes(r.measures.expectedUsers.value.value) && r.measures.expectedUsers.value.unit === 'registered users';
    const supplied = seed.id === 'missing-information' && r.measures?.concurrency?.state === 'KNOWN' && r.measures.concurrency.value.value === 100 && r.measures.concurrency.value.unit === 'concurrent users';
    if (r.origin !== original.origin && !((scale || supplied || r.description !== original.description) && r.origin === 'ASSUMED' && r.assumptionIds.length)) return false;
    if (Object.keys(r.measures ?? {}).sort().join('|') !== Object.keys(original.measures ?? {}).sort().join('|')) return false;
    return Object.entries(r.measures ?? {}).every(([key, value]) => {
      if (key === 'expectedUsers' && scale || key === 'concurrency' && supplied) return true;
      const old = original.measures?.[key];
      return old && old.state === value?.state && JSON.stringify(old.value) === JSON.stringify(value?.state === 'KNOWN' ? value.value : undefined);
    });
  });
  const supportedAssumptions = Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE').every(a => {
    if (fixture.analysis.assumptions.some(original => original.statement === a.statement) && !a.value) return true;
    if (seed.id === 'modernization' && a.statement === 'Planning target: 500,000 registered users.' && a.value?.kind === 'NUMBER' && a.value.value === 500000 && a.value.unit === 'registered users') return true;
    if (seed.id === 'missing-information' && a.statement === 'Planning target: 100 concurrent users.' && a.value?.kind === 'NUMBER' && a.value.value === 100 && a.value.unit === 'concurrent users') return true;
    if (seed.id === 'ai-enabled' && a.statement === 'A support agent and supervisor must approve every reply before it is sent.' && !a.value) return true;
    return false;
  });
  if (!supported || !supportedAssumptions) throw new ProviderError('No recorded selective MOCK variant for this scope. Supported edits: priority/inclusion, 500,000 registered users, supervisor reply approval, or supplied concurrency of 100. Existing work is preserved.');
}
export function mockRegeneration(request: ProviderRequest) {
  const context = request.boundedContext;
  if (!context || request.fixtureVariant !== 'phase4-selective' || !request.requestedItemIds.length) throw new ProviderError('No bounded selective MOCK fixture was supplied.');
  return { sections: context.targets.map(target => {
    const candidate = structuredClone(target.candidate) as SectionCandidate;
    const requirements = target.inputs.filter(i => i.node.kind === 'Requirement');
    const value = (id: string, key: string) => requirements.find(i => i.node.kind === 'Requirement' && i.node.id === id)?.values[key];
    if (candidate.payload.kind === 'Capability') {
      const id = candidate.payload.requirementIds[0]!;
      candidate.title = String(value(id, 'description'));
      candidate.payload.description = String(value(id, 'description'));
      candidate.payload.priority = value(id, 'priority') as 'HIGH' | 'MEDIUM' | 'LOW';
      candidate.payload.inclusion = value(id, 'inclusion') as 'INCLUDED' | 'EXCLUDED';
      candidate.payload.classification = candidate.payload.inclusion === 'EXCLUDED' ? 'OUT_OF_SCOPE' : value(id, 'origin') === 'ASSUMED' ? 'ASSUMPTION_DEPENDENT' : value(id, 'origin') === 'CUSTOMER_STATED' ? 'REQUESTED' : 'INTERPRETED';
      if (value(id, 'exclusionReason')) candidate.payload.exclusionReason = String(value(id, 'exclusionReason'));
    }
    if (candidate.payload.kind === 'Narrative') {
      const p = candidate.payload;
      if (p.topic === 'OVERVIEW') p.paragraphs = [{ text: `${String(target.inputs.find(i => i.node.kind === 'ScopingSession')?.values['context.opportunityName'] ?? 'Reviewed solution')}: proposed solution to the reviewed scope. ${requirements.map(i => `${'id' in i.node ? i.node.id : ''}: ${String(i.values.description)}`).join('\n')}`, origin: 'AI_INFERRED' }];
      if (['OBJECTIVES', 'JOURNEYS', 'FUNCTIONAL_REQUIREMENTS', 'NON_FUNCTIONAL_REQUIREMENTS', 'INTEGRATIONS', 'TRACEABILITY', 'EXCLUSIONS'].includes(p.topic)) p.paragraphs = requirements.map(i => ({ text: `${'id' in i.node ? i.node.id : ''}: ${String(i.values.description)}${i.values.measures ? ` Structured measures: ${JSON.stringify(i.values.measures)}.` : ''}`, origin: i.values.origin as 'CUSTOMER_STATED' | 'ASSUMED' | 'AI_INFERRED' }));
      if (p.topic === 'ASSUMPTIONS') p.paragraphs = target.inputs.filter(i => i.node.kind === 'Assumption').map(i => ({ text: `${'id' in i.node ? i.node.id : ''} (${String(i.values.validation)}): ${String(i.values.statement)}${i.values.value ? ` Reviewed value: ${JSON.stringify(i.values.value)}` : ''}`, origin: 'ASSUMED' }));
      if (p.topic === 'QUESTIONS') p.paragraphs = target.inputs.filter(i => i.node.kind === 'Question').map(i => ({ text: `${'id' in i.node ? i.node.id : ''} (${String(i.values.status)}): ${String(i.values.question)}${i.values.answer ? ` Answer: ${JSON.stringify(i.values.answer)}` : ''}`, origin: 'AI_INFERRED' }));
      const measures = requirements.flatMap(i => Object.entries((i.values.measures ?? {}) as Record<string, { state: string; value?: { value: number; unit: string } }>));
      if (['SCALABILITY', 'ENVIRONMENTS', 'AVAILABILITY'].includes(p.topic) && measures.length) {
        const facts = measures.filter(([, measure]) => measure.state === 'KNOWN').map(([key, measure]) => `${key}: ${measure.value!.value} ${measure.value!.unit}`).join('; ');
        p.paragraphs = [{ text: `${facts || 'Scale inputs remain unresolved'}. ${measures.some(([key, m]) => key === 'expectedUsers' && m.value?.value === 500000) ? 'Recommend explicit autoscaling and dedicated performance verification for the reviewed scale target. ' : ''}Validate peak concurrency, capacity limits and recovery targets before production sizing. Registered users do not establish concurrency; no cloud operating cost is inferred.`, origin: 'AI_INFERRED' }];
      }
      if (!p.paragraphs.length) p.paragraphs = [{ text: 'No applicable entries remain in the reviewed input set.', origin: 'AI_INFERRED' }];
    }
    if (candidate.payload.kind === 'AIUseCase' && requirements.some(i => String(i.values.description).includes('support agent and supervisor'))) {
      candidate.payload.humanDecisions = { state: 'KNOWN', value: 'A support agent and supervisor must approve every reply before sending.' };
      candidate.payload.humanReviewControls = { state: 'KNOWN', value: 'Require both support-agent and supervisor approval records for every reply. Autonomous sending is prohibited.' };
    }
    return candidate;
  }) };
}
