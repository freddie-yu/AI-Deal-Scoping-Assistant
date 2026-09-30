import type { ArtifactSection, ScopingSession, Requirement, Knowledge } from '../domain/index.js';
import type { SectionCandidate } from '../domain/deliverables.js';
export const known = (value: string): Knowledge<string> => ({ state: 'KNOWN', value });
export const na = (reason: string): Knowledge<string> => ({ state: 'NOT_APPLICABLE', reason });
export const unresolved = (s: ScopingSession, reason: string): Knowledge<string> => ({ state: 'UNRESOLVED', reason, questionIds: Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE' && q.status === 'OPEN').map(q => q.id) });
export const included = (s: ScopingSession) => Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE' && r.inclusion === 'INCLUDED');
export const accepted = (s: ScopingSession, kind: ArtifactSection['payload']['kind']) => Object.values(s.artifactSections).filter(a => a.payload.kind === kind && a.review === 'REVIEWED' && a.lifecycle === 'ACTIVE' && a.freshness === 'CURRENT');
export function base(key: string, title: string, requirements: Requirement[], rationale: string) {
  return { key, title, origin: 'AI_INFERRED' as const, requirementIds: requirements.map(r => r.id), assumptionIds: [] as string[], rationale, dependencies: [] as string[], applicability: known('Applicable to the reviewed scope.'), technologyChoices: [] };
}
export function narrative(artifactKind: 'PRD' | 'ARCHITECTURE' | 'DATA_STRATEGY' | 'INTEGRATION_STRATEGY' | 'AI_STRATEGY', key: string, title: string, topic: Extract<SectionCandidate['payload'], { kind: 'Narrative' }>['topic'], requirements: Requirement[], content: string, applicability = known('Applicable to the reviewed scope.')): SectionCandidate {
  return { ...base(key, title, requirements, `This ${title.toLowerCase()} proposal interprets the linked reviewed scope; it does not add customer facts.`), artifactKind, applicability, payload: { kind: 'Narrative', topic, paragraphs: [{ text: content, origin: 'AI_INFERRED' }], referencedIds: requirements.map(r => ({ kind: 'Requirement' as const, id: r.id })), affectedRefs: [] } };
}
