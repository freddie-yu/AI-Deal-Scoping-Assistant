import type { ScopingSession } from '../domain/index.js';
import { PRD_TOPICS, type SectionCandidate } from '../domain/deliverables.js';
import { base, included, narrative, na } from './shared.js';
export function generatePRD(s: ScopingSession): SectionCandidate[] {
  const all = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE'); const active = included(s);
  const groups = { OBJECTIVES: ['BR'], PROBLEM: ['BR'], PERSONAS: ['FR'], JOURNEYS: ['FR'], FUNCTIONAL_REQUIREMENTS: ['FR'], NON_FUNCTIONAL_REQUIREMENTS: ['NFR', 'SEC', 'DATA'], INTEGRATIONS: ['INT'] };
  return PRD_TOPICS.map(topic => {
    const types = groups[topic as keyof typeof groups];
    const refs = topic === 'EXCLUSIONS' ? all.filter(r => r.inclusion === 'EXCLUDED') : types ? active.filter(r => types.includes(r.type)) : active;
    let content = refs.map(r => `${r.id}: ${r.description}${r.exclusionReason ? ` Excluded: ${r.exclusionReason}` : ''}`).join('\n');
    if (topic === 'OVERVIEW') content = `${s.context.opportunityName}: proposed solution to the reviewed scope. ${content}`;
    if (topic === 'PROBLEM') content = active.filter(r => r.type === 'BR').map(r => `${r.id}: ${r.description}`).join('\n') || 'The business problem requires customer clarification; this proposal implements the linked workflows only.';
    if (topic === 'PERSONAS') {
      const roles = refs.flatMap(r => /Operations staff/i.test(r.description) ? ['Operations staff create and track orders.'] : /support agent/i.test(r.description) ? ['Support agents review and approve replies.'] : /Customers need/i.test(r.description) ? ['Customers use the self-service workflow.'] : /operator/i.test(r.description) ? ['Operators inspect failed synchronization and control recovery.'] : []);
      content = `Interpretation of reviewed workflows: ${roles.length ? [...new Set(roles)].join(' ') : 'Business users participate in the linked workflows; specific personas remain unresolved.'} Validate permissions and detailed responsibilities with the customer.`;
    }
    if (topic === 'DEPENDENCIES') content = active.flatMap(r => r.dependencyIds.map(id => `${r.id} depends on ${id}`)).join('\n') || 'No explicit requirement dependencies were recorded. Validate system access and acceptance criteria before delivery.';
    if (topic === 'ASSUMPTIONS') content = Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE').map(a => `${a.id} (${a.validation}): ${a.statement}`).join('\n');
    if (topic === 'QUESTIONS') content = Object.values(s.questions).filter(q => q.lifecycle === 'ACTIVE').map(q => `${q.id} (${q.status}): ${q.question}${q.answer ? ` Answer: ${q.answer.text}` : ''}`).join('\n');
    if (topic === 'RISKS') content = 'Validate unresolved discovery inputs before selecting capacity or making delivery commitments. Provisional assumptions are reviewed planning inputs, not confirmed customer facts.';
    const section = narrative('PRD', `prd-${topic.toLowerCase().replaceAll('_', '-')}`, topic.replaceAll('_', ' '), topic, refs.length ? refs : active, content || `No ${topic.toLowerCase()} recorded in reviewed scope.`, content ? undefined : na(`No ${topic.toLowerCase()} recorded.`));
    if (['OBJECTIVES', 'JOURNEYS', 'FUNCTIONAL_REQUIREMENTS', 'NON_FUNCTIONAL_REQUIREMENTS', 'INTEGRATIONS', 'TRACEABILITY'].includes(topic) && refs.length && section.payload.kind === 'Narrative') section.payload.paragraphs = refs.map(r => ({ text: `${r.id}: ${r.description}`, origin: r.origin }));
    if (topic === 'ASSUMPTIONS') section.assumptionIds = Object.values(s.assumptions).filter(a => a.lifecycle === 'ACTIVE').map(a => a.id);
    return section;
  });
}
export function generateFunctionalScope(s: ScopingSession): SectionCandidate[] {
  return Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE').map(r => ({
    ...base(`cap-${r.id.toLowerCase().replaceAll('_', '-')}`, r.description, [r], `Implement or verify the specific scope of ${r.id}; grouping adds no new customer requirement.`), artifactKind: 'FUNCTIONAL_SCOPE', dependencies: r.dependencyIds.map(id => `local:cap-${id.toLowerCase().replaceAll('_', '-')}`),
    payload: { kind: 'Capability', description: r.description, priority: r.priority, inclusion: r.inclusion, classification: r.inclusion === 'EXCLUDED' ? 'OUT_OF_SCOPE' : r.origin === 'ASSUMED' ? 'ASSUMPTION_DEPENDENT' : r.origin === 'CUSTOMER_STATED' ? 'REQUESTED' : 'INTERPRETED', requirementIds: [r.id], module: ({ BR: 'Business outcomes', FR: 'Application workflows', NFR: 'Service quality', DATA: 'Data', INT: 'Integrations', SEC: 'Security' })[r.type], ...(r.exclusionReason ? { exclusionReason: r.exclusionReason } : {}) },
  }));
}
