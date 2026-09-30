import type { ScopingSession, Requirement } from '../domain/index.js';
import type { SectionCandidate } from '../domain/deliverables.js';
import { AWS_CATALOG, type ServiceKey } from '../architecture/catalog.js';
import { base, included, known, narrative, unresolved, na } from './shared.js';
export function generateArchitecture(s: ScopingSession): SectionCandidate[] {
  const requirements = included(s); const workflows = requirements.filter(r => r.type === 'FR'); const core = workflows.length ? workflows : requirements;
  const data = requirements.filter(r => r.type === 'DATA'); const security = requirements.filter(r => r.type === 'SEC'); const integrations = requirements.filter(r => r.type === 'INT');
  const sections: SectionCandidate[] = [];
  const component = (key: string, service: ServiceKey, title: string, refs: Requirement[], purpose: string, dependencies: string[] = []) => {
    const section: SectionCandidate = { ...base(key, title, refs.length ? refs : core, purpose), artifactKind: 'ARCHITECTURE', dependencies: dependencies.map(k => `local:${k}`), technologyChoices: [{ key: 'service', target: AWS_CATALOG[service].role, technologyKey: known(service) }], payload: { kind: 'ArchitectureComponent', name: title, cloud: 'AWS', catalogServiceKey: service, purpose, rationale: `${purpose} This service is a proposed implementation of ${refs.length ? refs.map(r => r.id).join(', ') : core.map(r => r.id).join(', ')}. Validate sizing and customer technology approval.`, tradeOffs: known('Managed operations reduce infrastructure administration but introduce AWS coupling and service limits; no capacity or cost guarantee is made.'), securityControls: known('Least-privilege IAM roles, encryption in transit and at rest, restricted network access, redacted logs and managed credentials.'), connections: dependencies.map(k => ({ from: { kind: 'COMPONENT', sectionId: `local:${key}` }, to: { kind: 'COMPONENT', sectionId: `local:${k}` }, description: 'Authorized application data flow' })) } };
    sections.push(section); return section;
  };
  component('database', 'aws:rds-postgresql', 'Transactional records', data, 'Store reviewed business records in PostgreSQL; preserve stated database compatibility. Use managed backups and test restore procedures.');
  component('static-assets', 'aws:s3', 'Application assets', core, 'Store versioned static application assets with private bucket access.');
  component('identity', 'aws:cognito', 'User identity', security, 'Authenticate users of the reviewed workflows; customer identity federation and permission mapping remain to be confirmed.');
  component('runtime', 'aws:lambda', 'Application backend', core, 'Execute deterministic workflow rules with bounded requests; benchmark service limits before selecting production capacity.', ['database', 'identity']);
  component('api', 'aws:api-gateway', 'Application API', core, 'Expose authenticated workflow endpoints and validate input before executing business rules.', ['runtime']);
  component('web', 'aws:cloudfront', 'User application', core, 'Deliver the browser application for the reviewed workflows over TLS.', ['static-assets', 'api']);
  if (security.length) component('encryption', 'aws:kms', 'Encryption keys', security, 'Manage encryption keys and audit key access for protected customer records.', ['database']);
  if (integrations.length) {
    component('credentials', 'aws:secrets-manager', 'Integration credentials', integrations, 'Protect external API credentials; validate credential ownership and rotation procedures.');
    component('retry-queue', 'aws:sqs', 'Synchronization recovery', integrations, 'Isolate transient synchronization failures and route exhausted retries to operator review.', ['runtime']);
    for (const r of integrations) {
      const name = r.description.includes('Salesforce') ? 'Salesforce' : r.description.includes('warehouse') ? 'Warehouse API' : 'Billing API';
      const section = component(`integration-${r.id.toLowerCase().replaceAll('_', '-')}`, 'aws:lambda', `${name} adapter`, [r], `Map and reconcile the ${name} interface required by ${r.id}; validate API access and contract.`, ['credentials', 'retry-queue']);
      if (section.payload.kind === 'ArchitectureComponent') section.payload.connections.push({ from: { kind: 'COMPONENT', sectionId: `local:${section.key}` }, to: { kind: 'EXTERNAL_SYSTEM', name, description: r.description, sources: [], requirementIds: [r.id] }, description: 'Authenticated API exchange; access pending validation' });
    }
  }
  const ai = requirements.filter(r => r.description.includes('draft replies'));
  if (ai.length) component('ai-model', 'aws:bedrock', 'Support draft model', ai, 'Generate support reply drafts from approved articles; human approval remains mandatory and sending is deterministic.', ['runtime']);
  component('observability', 'aws:cloudwatch', 'Operational monitoring', core, 'Observe workflow failures, latency and recovery; redact customer content and define alert ownership.', ['runtime']);
  const concerns = [
    ['deployment', 'DEPLOYMENT', 'Use versioned releases, infrastructure as code and rollback verification; customer release approval is required.'],
    ['environments', 'ENVIRONMENTS', 'Recommend separated development, test and production environments; isolation, access and promotion policies require customer review.'],
    ['availability', 'AVAILABILITY', 'Recommend managed redundancy and restore exercises. Availability targets, regions and recovery objectives require clarification.'],
    ['scalability', 'SCALABILITY', 'Registered users do not establish concurrency. Validate peak load and benchmark before choosing capacity; no specific concurrency is assumed.'],
    ['recovery', 'RECOVERY', 'Recommend encrypted database backups, versioned assets and tested recovery. Retention, RPO and RTO remain unresolved.'],
    ['messaging', 'ARCHITECTURE', integrations.length ? 'Queue asynchronous recovery for the reviewed external interfaces.' : 'No asynchronous integration requirement is recorded; additional messaging is not proposed.'],
  ] as const;
  for (const [key, topic, content] of concerns) {
    const scale = ['scalability', 'environments', 'availability'].includes(key);
    const related = scale ? requirements.filter(r => r.type === 'NFR') : requirements;
    const refs = related.length ? related : core;
    const measures = scale ? refs.flatMap(r => Object.entries(r.measures ?? {}).map(([name, measure]) => `${name}: ${measure?.state === 'KNOWN' ? `${measure.value.value} ${measure.value.unit}` : 'unresolved'}`)).join('; ') : '';
    sections.push(narrative('ARCHITECTURE', key, key, topic, refs, measures ? `${measures}. ${content}` : content, key === 'scalability' || key === 'availability' || key === 'recovery' ? unresolved(s, content) : key === 'messaging' && !integrations.length ? na(content) : known('AI-generated recommendation; human review required.')));
  }
  return sections;
}
