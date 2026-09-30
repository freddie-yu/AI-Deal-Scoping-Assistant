import { ConfigurationSchema, type Configuration, type ScopingSession, type InputRef, type NodeRef, type UnitType } from '../domain/index.js';
import { sourceHash } from '../ingestion/sources.js';
export const RULESET = { kind: 'RULESET', id: 'demo-rom', version: 'demo-rom-v1', hash: sourceHash('demo-rom-v1:canonical:three-flags:exact-rational:pooled-sequential:per-unit-minor-rounding') } as const;
export const PRIMARY: UnitType[] = ['APPLICATION', 'INTEGRATION', 'DATA', 'CLOUD', 'AI', 'SECURITY'];
export const DRIVER_KEYS: Record<Exclude<UnitType, 'DISCOVERY' | 'HANDOVER'>, [string, string, string]> = {
  APPLICATION: ['branching', 'realtime', 'permissions'], INTEGRATION: ['customAuthentication', 'asynchronous', 'transformation'],
  DATA: ['legacyCleanup', 'transformation', 'volumeGovernance'], CLOUD: ['performance', 'availability', 'disasterRecovery'],
  AI: ['retrieval', 'orchestration', 'enhancedSafety'], SECURITY: ['federatedIdentity', 'sensitiveData', 'compliance'],
  TESTING: ['crossSystem', 'anyHigh', 'dedicatedVerification'],
};
export const DRIVER_LABELS: Record<string, string> = { branching: 'Branching workflow beyond basic CRUD', realtime: 'Offline or realtime behavior', permissions: 'Complex permission rules', customAuthentication: 'Custom or federated authentication', asynchronous: 'Asynchronous, event or batch processing', transformation: 'Nontrivial transformation or reconciliation', legacyCleanup: 'Legacy cleanup', volumeGovernance: 'Special volume or governance handling', performance: 'Explicit autoscaling or performance design', availability: 'Enhanced availability', disasterRecovery: 'Custom disaster recovery', retrieval: 'Retrieval', orchestration: 'Multi-step or tool orchestration', enhancedSafety: 'Enhanced evaluation or safety', federatedIdentity: 'Federated or multi-tenant identity', sensitiveData: 'Sensitive-data or privacy controls', compliance: 'Formal compliance evidence', crossSystem: 'Cross-system end-to-end verification', anyHigh: 'Any included HIGH integration, data or AI unit', dedicatedVerification: 'Dedicated performance or security verification' };
export function canonicalJSON(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`;
}
export const hash = (v: unknown) => sourceHash(canonicalJSON(v));
export function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined, value);
}
export function ref(node: NodeRef, value: unknown, fields: string[], revision = 1): InputRef { return { node, fields, consumedRevision: revision, valueHash: hash(value) }; }
export function sectionRef(s: ScopingSession, id: string, fields: string[]): InputRef {
  const a = s.artifactSections[id];
  return ref({ kind: 'ArtifactSection', id }, fields.map(f => f === 'exists' ? !!a : readPath(a, f)), fields, a?.revision ?? 0);
}
export const ruleRef = () => ref(RULESET, RULESET, ['version', 'hash']);
export function resolveConfig<T>(s: ScopingSession, key: string, visited = new Set<string>()): { value: T | null; inputs: InputRef[]; reason?: string } {
  const node = { kind: 'CONFIGURATION', id: 'CFG_01', key } as const;
  const entry = s.configuration.entries[key];
  const input = ref(node, entry?.kind === 'VALUE' ? { value: entry.value, basis: entry.basis } : entry ? { owner: entry.owner, field: entry.field, basis: entry.basis } : null, entry?.kind === 'ALIAS' ? ['owner', 'field', 'basis'] : ['value', 'basis'], entry?.revision ?? 0);
  const fail = (reason: string) => ({ value: null, inputs: [input], reason });
  if (visited.has(key)) throw new Error(`Configuration alias cycle: ${key}`);
  if (!entry || entry.validation !== 'VALIDATED') return fail(`${key}: missing or unvalidated; requires an explicit reviewed value`);
  if (entry.kind === 'VALUE') return entry.value.state === 'KNOWN' ? { value: entry.value.value as T, inputs: [input] } : fail(`${key}: ${entry.value.reason}`);
  if (entry.owner.kind === 'CONFIGURATION') {
    const resolved = resolveConfig<T>(s, entry.owner.key, new Set(visited).add(key));
    return { ...resolved, inputs: [input, ...resolved.inputs] };
  }
  const n = entry.owner;
  const owner = n.kind === 'Assumption' ? s.assumptions[n.id] : n.kind === 'Requirement' ? s.requirements[n.id] : undefined;
  if (!owner || owner.lifecycle !== 'ACTIVE' || owner.review !== 'REVIEWED' || owner.reviewedRevision !== owner.revision || 'validation' in owner && owner.validation === 'UNVALIDATED') return fail(`${key}: alias owner is not reviewed/current`);
  let value = readPath(owner, entry.field);
  const ownerInput = ref(n, value, [entry.field], owner.revision);
  if (value && typeof value === 'object' && 'state' in value) value = value.state === 'KNOWN' && 'value' in value ? value.value : null;
  if (value && typeof value === 'object' && 'kind' in value && 'value' in value) value = value.value;
  return { value: (value ?? null) as T | null, inputs: [input, ownerInput], ...(value == null ? { reason: `${key}: unresolved alias owner` } : {}) };
}
export function configRef(s: ScopingSession, key: string) { return resolveConfig(s, key).inputs[0]!; }
export function setConfig(s: ScopingSession, key: string, value: unknown, basis: string, validated: boolean) {
  s.configuration.entries[key] = { key, revision: (s.configuration.entries[key]?.revision ?? 0) + 1, basis, origin: 'ASSUMED', validation: validated ? 'VALIDATED' : 'UNVALIDATED', kind: 'VALUE', value: value === null ? { state: 'UNRESOLVED', reason: `Reviewer must supply ${key}`, questionIds: [] } : { state: 'KNOWN', value } } as Configuration['entries'][string];
}
export function demoConfiguration(): Configuration {
  const entries: Configuration['entries'] = {};
  const add = (key: string, value: unknown) => { entries[key] = { key, revision: 1, basis: 'DEMO CONFIGURATION / HEURISTIC DEFAULTS — deterministic-estimation-rules §4; requires human review, not a market benchmark.', origin: 'ASSUMED', validation: 'UNVALIDATED', kind: 'VALUE', value: { state: 'KNOWN', value } } as Configuration['entries'][string]; };
  const bases: Record<UnitType, [number, number, Record<string, number>]> = { DISCOVERY: [5, 8, { A: 1 }], APPLICATION: [4, 6, { A: .1, E: .9 }], INTEGRATION: [3, 5, { E: .8, D: .2 }], DATA: [4, 7, { D: 1 }], CLOUD: [2, 3, { C: 1 }], AI: [5, 8, { D: 1 }], SECURITY: [3, 5, { A: .2, C: .8 }], TESTING: [1, 2, { E: .2, Q: .8 }], HANDOVER: [2, 3, { A: .5, C: .5 }] };
  for (const [type, [low, high, shares]] of Object.entries(bases)) { add(`baseEffort.${type}`, { low, high, unit: 'person-days/unit' }); add(`roleAllocation.${type}`, shares); add(`productivity.${type}`, 1); }
  for (const [band, value] of Object.entries({ LOW: 1, MEDIUM: 1.5, HIGH: 2 })) add(`complexityMultipliers.${band}`, value);
  for (const [role, rate, capacity] of [['A', 100000, .5], ['E', 80000, 2], ['D', 90000, 1], ['C', 85000, 1], ['Q', 60000, 1]] as const) { add(`rates.${role}`, { amount: rate, currency: 'USD', unit: 'minor-units/person-day' }); add(`capacity.${role}`, capacity); }
  for (const [key, value] of Object.entries({ currency: { code: 'USD', minorUnitDigits: 2 }, contingencyPercent: 15, startDate: '2026-10-05', workingWeekdays: [1, 2, 3, 4, 5], holidays: [], daysPerPersonWeek: 5, effortRounding: .1, calendarRounding: 1, commercialRounding: 1000, calibration: { status: 'DEMO', evidence: 'Uncalibrated illustrative heuristic baselines; approval is not calibration.' }, supportedVolumeThreshold: 20, contingencyReviewThreshold: 50 })) add(key, value);
  for (const type of PRIMARY) add(`inventoryComplete.${type}`, false);
  entries.deliveryDeadline = { key: 'deliveryDeadline', revision: 1, basis: 'No requested deadline supplied. Optional absence has no confidence penalty.', origin: 'ASSUMED', validation: 'UNVALIDATED', kind: 'VALUE', value: { state: 'NOT_APPLICABLE', reason: 'No delivery deadline requested' } };
  return ConfigurationSchema.parse({ id: 'CFG_01', revision: 1, entries });
}
