import type { ScopingSession } from '../domain/index.js';
import type { SectionCandidate } from '../domain/deliverables.js';
import { accepted, base, included } from './shared.js';
export function generateDeliveryPlan(s: ScopingSession): SectionCandidate[] {
  const scope = [...accepted(s, 'Capability'), ...accepted(s, 'ArchitectureComponent'), ...accepted(s, 'DataDomain'), ...accepted(s, 'Integration'), ...accepted(s, 'AIUseCase')].filter(a => a.payload.kind !== 'Capability' || a.payload.inclusion === 'INCLUDED');
  if (!scope.length) throw new Error('Accept scope and design sections before proposing delivery workstreams.');
  const phases = [
    { key: 'discovery', name: 'Discovery and architecture', kinds: [] as string[], roles: ['Architect', 'Business analyst'] },
    { key: 'foundation', name: 'Platform and security', kinds: ['ArchitectureComponent'], roles: ['Cloud engineer', 'Security engineer'] },
    { key: 'implementation', name: 'Application, data and integration', kinds: ['Capability', 'DataDomain', 'Integration'], roles: ['Application engineer', 'Data engineer'] },
    { key: 'ai', name: 'AI drafting controls', kinds: ['AIUseCase'], roles: ['AI engineer', 'Support reviewer'] },
    { key: 'validation', name: 'Testing and hardening', kinds: [] as string[], roles: ['QA engineer', 'Security reviewer'] },
    { key: 'handover', name: 'Release and handover', kinds: [] as string[], roles: ['Cloud engineer', 'Operations owner'] },
  ].filter(p => !p.kinds.length || scope.some(a => p.kinds.includes(a.payload.kind)));
  return phases.map((p, index) => {
    const related = scope.filter(a => !p.kinds.length || p.kinds.includes(a.payload.kind));
    const reqIds = new Set(related.flatMap(a => a.grounding.filter(g => g.source.kind === 'Requirement').map(g => g.source.id)));
    const asmIds = [...new Set(related.flatMap(a => a.grounding.filter(g => g.source.kind === 'Assumption').map(g => g.source.id)))];
    return { ...base(`delivery-${p.key}`, p.name, included(s).filter(r => reqIds.has(r.id)), 'Organize accepted design scope into a reviewable delivery sequence. Roles and complexity are advisory; no canonical estimation units or numerical estimates are created.'), assumptionIds: asmIds, artifactKind: 'DELIVERY_PLAN', dependencies: related.map(a => a.id), payload: { kind: 'Workstream', name: p.name, phaseKey: p.key, phaseOrder: index + 1, predecessorRefs: index ? [`local:delivery-${phases[index - 1]!.key}`] : [], milestones: [{ key: `${p.key}-reviewed`, label: `${p.name} reviewed and accepted` }], risks: ['Resolve linked discovery questions and validate external dependencies before committing delivery.'], exclusions: ['Effort, schedule and commercial values are deferred to Phase 3.'], advisory: { scopeRefs: related.map(a => a.id), suggestedRoles: p.roles, complexity: related.some(a => a.payload.kind === 'Integration' || a.payload.kind === 'AIUseCase') ? 'HIGH' : 'MEDIUM', drivers: ['Accepted workflow boundaries', 'Security and recovery validation', 'Unresolved customer inputs'] } } };
  });
}
