import { newSession } from '../../src/application/sessions.js';
import { ArtifactSectionSchema, type ScopingSession, type ArtifactSection } from '../../src/domain/index.js';
import { demoConfiguration, setConfig, DRIVER_KEYS, PRIMARY } from '../../src/estimation/config.js';
import { reconcileUnits, addBoundary, reviewUnits } from '../../src/estimation/reconcile.js';
export const known = <T>(value: T) => ({ state: 'KNOWN' as const, value });
export function addSection(s: ScopingSession, payload: object, title: string) {
  const id = `AS_${String(++s.idCounters.AS).padStart(2, '0')}`;
  s.artifactSections[id] = ArtifactSectionSchema.parse({ id, artifactId: 'ART_01', sectionKey: id, title, payload, revision: 1, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: 1, reviewedAt: '2026-09-23T00:00:00Z', lastChangedBy: 'HUMAN', origin: 'ASSUMED', grounding: [], inputs: [], freshness: 'CURRENT', staleCauses: [] });
  return s.artifactSections[id]!;
}
export function goldenSession() {
  let s = newSession({ customerName: 'Golden', opportunityName: 'Rules §9' });
  s.configuration = demoConfiguration();
  const phaseFor = { DISCOVERY: 'discovery', CLOUD: 'foundation', SECURITY: 'foundation', APPLICATION: 'implementation', DATA: 'implementation', INTEGRATION: 'implementation', AI: 'ai', TESTING: 'validation', HANDOVER: 'handover' };
  for (const [index, key] of ['discovery', 'foundation', 'implementation', 'ai', 'validation', 'handover'].entries()) {
    addSection(s, { kind: 'Workstream', name: key, phaseKey: key, phaseOrder: index + 1, predecessorRefs: [], milestones: [{ key, label: key }], risks: [], exclusions: [] }, key);
    setConfig(s, `phaseMinimumDays.${key}`, 2, 'Reviewed example', true); setConfig(s, `wait.${key}`, { low: 0, high: 0, unit: 'working-days' }, 'Reviewed example', true);
  }
  for (let i = 0; i < 4; i++) addSection(s, { kind: 'Capability', description: `Workflow ${i}`, priority: 'HIGH', inclusion: 'INCLUDED', classification: 'REQUESTED', requirementIds: ['FR_01'] }, `Application ${i}`);
  const endpoint = { kind: 'EXTERNAL_SYSTEM', name: 'Fixture', description: 'Contract', sources: [], requirementIds: ['FR_01'] };
  for (const name of ['INT_A', 'INT_B', 'INT_C']) addSection(s, { kind: 'Integration', name, endpoints: [endpoint, endpoint], pattern: 'API', dataDomainRefs: [], authentication: known('Custom'), errors: known('Error'), retry: known('Retry'), monitoring: known('Monitor'), synchronization: known('Sync') }, name);
  const data = addSection(s, { kind: 'DataDomain', name: 'Data', sources: [], storageRefs: [], flows: [], ...Object.fromEntries(['ownership', 'ingestion', 'quality', 'governance', 'metadata', 'retention', 'privacy', 'security', 'analytics', 'recovery'].map(k => [k, known('Reviewed')])) }, 'Data');
  const arch = addSection(s, { kind: 'ArchitectureComponent', name: 'Cloud', cloud: 'AWS', catalogServiceKey: 'aws:ecs-fargate', purpose: 'Host', rationale: 'Reviewed', tradeOffs: known('Reviewed'), securityControls: known('Reviewed'), connections: [] }, 'Cloud');
  addSection(s, { kind: 'AIUseCase', purpose: 'AI', aiRequirementIds: ['FR_01'], ...Object.fromEntries(['deterministicAlternative', 'humanDecisions', 'pattern', 'modelOptions', 'frameworkRationale', 'retrieval', 'orchestration', 'prompts', 'outputManagement', 'evaluation', 'safety', 'privacy', 'monitoring', 'feedback', 'humanReviewControls'].map(k => [k, known('Reviewed')])) }, 'AI');
  s = reconcileUnits(s);
  s = addBoundary(s, { unitType: 'DATA', name: 'Migration', boundary: 'Reviewed migration package', scopeRefs: [data.id] });
  for (const name of ['Development', 'Test', 'Production']) s = addBoundary(s, { unitType: 'CLOUD', name, boundary: 'Named environment provisioning', scopeRefs: [arch.id] });
  for (const type of PRIMARY) setConfig(s, `inventoryComplete.${type}`, true, 'Complete reviewed §9 inventory', true);
  for (const a of Object.values(s.artifactSections)) if (a.payload.kind === 'EstimationUnit') {
    const p = a.payload; p.inclusion = known('INCLUDED');
    if (p.drivers.policy === 'THREE_FLAGS') for (const [index, flag] of p.drivers.flags.entries()) if (!flag.derivation) {
      const node = flag.inputs[0]!.node; if (node.kind === 'CONFIGURATION') setConfig(s, node.key, p.unitType === 'DATA' || p.unitType === 'SECURITY' ? index === 1 : index === 0, 'Reviewed §9 flags', true);
    }
    if (p.unitType === 'INTEGRATION') setConfig(s, `readiness.${a.id}`, true, 'Confirmed fixture API readiness', true);
  }
  s = reconcileUnits(s);
  for (const e of Object.values(s.configuration.entries)) e.validation = 'VALIDATED';
  return reviewUnits(s, '2026-09-23T00:00:00Z');
}
export function unitByName(s: ScopingSession, name: string): ArtifactSection & { payload: Extract<ArtifactSection['payload'], { kind: 'EstimationUnit' }> } {
  const source = Object.values(s.artifactSections).find(a => a.title === name && a.payload.kind !== 'EstimationUnit')!;
  return Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimationUnit' && a.payload.source.kind === 'DOMAIN' && a.payload.source.sectionId === source.id) as ReturnType<typeof unitByName>;
}
