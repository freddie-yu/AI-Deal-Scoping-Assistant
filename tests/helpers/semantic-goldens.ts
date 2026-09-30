import { expect } from 'vitest';
import type { ScopingSession } from '../../src/domain/index.js';
import { exactExcerpt } from '../../src/ingestion/sources.js';
import type { loadSeed } from '../../src/seeds/loader.js';
const aliases: Record<string, string[]> = {
  Salesforce: ['Salesforce'], Atlas: ['Atlas'], 'order tracking': ['create and track orders'], 'order synchronization': ['Synchronize approved orders'],
  'support reply drafting': ['draft replies'], 'human reply approval': ['approve every reply'], 'customer self-service': ['customer self-service'],
};
export function assertSemanticGoldens(s: ScopingSession, manifest: Awaited<ReturnType<typeof loadSeed>>) {
  const golden = manifest.semanticGoldenExpectations!;
  const facts = s.context.analysisSectionIds.flatMap(id => { const section = s.artifactSections[id]!; return section.payload.kind === 'Narrative' ? (section.payload.facts ?? []).map(f => ({ ...f, origin: section.origin })) : []; });
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE');
  const questions = Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE');
  for (const assertion of [...golden.mustExtract, ...golden.mustClassify]) {
    if (assertion.selector === 'payload.facts') {
      const fact = facts.find(f => f.subject === assertion.relatedAliases[0] && f.value === assertion.expectedValue);
      expect(fact, `missing structured ${assertion.description}`).toBeDefined();
      expect(fact!.requirementIds.length).toBeGreaterThan(0);
      for (const id of fact!.requirementIds) {
        const r = s.requirements[id]!; expect(r?.lifecycle).toBe('ACTIVE');
        if (assertion.origin) { expect(fact!.origin).toBe(assertion.origin); expect(r.origin).toBe(assertion.origin); }
        expect(r.evidence.some(a => (aliases[String(assertion.expectedValue)] ?? [String(assertion.expectedValue)]).some(token => exactExcerpt(s, a).includes(token)))).toBe(true);
      }
    } else throw new Error(`Unregistered golden selector ${assertion.selector}`);
  }
  for (const assertion of golden.mustIdentifyMissing) {
    const question = questions.find(q => q.subject === assertion.relatedAliases[0]);
    expect(question, `missing ${assertion.description} question`).toBeDefined(); expect(question!.question.trim().length).toBeGreaterThan(0); expect(question!.status).toBe('OPEN');
    if (assertion.selector === 'measures.concurrency') {
      const record = requirements.find(r => r.measures?.concurrency?.state === 'UNRESOLVED');
      expect(record).toBeDefined(); expect(record!.questionIds).toContain(question!.id);
      const measure = record!.measures!.concurrency!;
      if (measure.state !== 'UNRESOLVED') throw new Error('Missing concurrency must stay unresolved');
      expect(measure.questionIds).toContain(question!.id);
    } else if (assertion.selector !== 'question') throw new Error(`Unregistered golden selector ${assertion.selector}`);
  }
  for (const assertion of golden.mustNotInvent) {
    if (assertion.selector === 'measures.concurrency') expect(requirements.some(r => r.measures?.concurrency?.state === 'KNOWN')).toBe(false);
    else if (assertion.selector === 'payload.facts') expect(facts.some(f => f.subject === assertion.relatedAliases[0] && f.value === assertion.expectedValue)).toBe(false);
    else throw new Error(`Unregistered golden selector ${assertion.selector}`);
  }
  // Downstream expectations are exercised by phase2-goldens after human acceptance.
  for (const field of ['expectedCapabilities', 'expectedRecommendationConstraints'] as const) if (!golden[field].length) expect(golden.emptyReasons[field]).toBeTruthy();
}
