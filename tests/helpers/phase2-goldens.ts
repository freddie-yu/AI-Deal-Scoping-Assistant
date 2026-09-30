import { expect } from 'vitest';
import type { ScopingSession } from '../../src/domain/index.js';
import type { loadSeed } from '../../src/seeds/loader.js';
import { unsupportedAdditions } from '../../src/traceability/coverage.js';
import { technologyChecks } from '../../src/validation/deliverables.js';
export function assertPhase2Goldens(s: ScopingSession, seed: Awaited<ReturnType<typeof loadSeed>>) {
  const e = seed.phase2Expectations!; expect(e).toBeDefined();
  const sections = Object.values(s.artifactSections).filter(a => a.review === 'REVIEWED' && s.artifacts[a.artifactId]?.kind !== 'ANALYSIS');
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE');
  const resolve = (source: string) => { const r = requirements.find(r => r.evidence.some(a => a.excerpt.includes(source))); expect(r, `Missing source ${source}`).toBeDefined(); return r!.id; };
  const caps = sections.filter(a => a.payload.kind === 'Capability');
  for (const source of [...e.mustHaveCapabilities, ...e.mustCoverRequirements]) { const id = resolve(source); expect(caps.some(a => a.payload.kind === 'Capability' && a.payload.inclusion === 'INCLUDED' && a.payload.requirementIds.includes(id) && a.grounding.some(g => g.source.id === id)), `Missing capability for ${id}`).toBe(true); }
  if (e.mustNotAddUnsupportedCapability) expect(unsupportedAdditions(s, sections)).toEqual([]);
  const keys = sections.flatMap(a => a.payload.kind === 'ArchitectureComponent' ? [a.payload.catalogServiceKey] : []);
  e.expectedArchitecture.forEach(k => expect(keys).toContain(k)); e.forbiddenArchitecture.forEach(k => expect(keys).not.toContain(k));
  for (const expected of e.expectedIntegrations) {
    const id = resolve(expected.sourceText); const a = sections.find(a => a.payload.kind === 'Integration' && a.payload.name === expected.name);
    expect(a, `Missing ${expected.name}`).toBeDefined(); expect(a!.grounding.some(g => g.source.id === id)).toBe(true);
    if (a!.payload.kind === 'Integration') { expect(a!.payload.endpoints.some(ep => ep.kind === 'EXTERNAL_SYSTEM' && ep.name === expected.name && ep.requirementIds.includes(id))).toBe(true); for (const field of ['errors', 'retry', 'synchronization'] as const) expect(a!.payload[field].state).toBe('KNOWN'); }
  }
  for (const expected of e.expectedAIUseCases) {
    const id = resolve(expected.sourceText); const a = sections.find(a => a.payload.kind === 'AIUseCase' && a.payload.aiRequirementIds.includes(id)); expect(a, 'Missing grounded AI use case').toBeDefined();
    if (a!.payload.kind !== 'AIUseCase') throw new Error('Missing AI payload');
    expect(a!.grounding.some(g => g.source.id === id)).toBe(true);
    for (const field of ['deterministicAlternative', 'evaluation', 'privacy', 'safety', 'humanReviewControls', 'frameworkRationale'] as const) expect(a!.payload[field].state).toBe('KNOWN');
    if (expected.humanApproval) { const controls = a!.payload.humanReviewControls; expect(controls.state === 'KNOWN' && /mandatory|must|requires/i.test(controls.value)).toBe(true); const humanReq = resolve('approve every reply'); expect(a!.grounding.some(g => g.source.id === humanReq)).toBe(true); }
  }
  if (e.forbiddenAIUseCases.includes('ALL')) expect(sections.some(a => a.payload.kind === 'AIUseCase')).toBe(false);
  for (const constraint of e.expectedRecommendationConstraints) {
    if (constraint === 'POSTGRESQL_COMPATIBLE') { expect(technologyChecks(s, sections).some(c => c.status === 'CONFLICT')).toBe(false); expect(technologyChecks(s, sections).some(c => c.status === 'COMPATIBLE')).toBe(true); }
    if (constraint === 'NO_INVENTED_SCALE') { const scale = sections.find(a => a.payload.kind === 'Narrative' && a.payload.topic === 'SCALABILITY'); expect(scale?.applicability?.state).toBe('UNRESOLVED'); expect(JSON.stringify(scale?.payload)).not.toMatch(/\b\d[\d,]*\s+(concurrent|concurrency)/i); }
    if (constraint === 'NO_UNGROUNDED_RECOMMENDATIONS') expect(unsupportedAdditions(s, sections)).toEqual([]);
  }
}
