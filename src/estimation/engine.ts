import { ConfigurationSchema, ScopingSessionSchema, type ScopingSession, type ArtifactSection, type InputRef, type Range, type EstimateItem, type EstimateSummary, type NodeRef } from '../domain/index.js';
import { allocateId } from '../domain/ids.js';
import { RULESET, PRIMARY, resolveConfig, configRef, ruleRef, sectionRef, ref, hash, canonicalJSON } from './config.js';
import { units, estimateArtifact, type UnitSection } from './reconcile.js';
import { R, range, exactRange, sumExact, outward, headline, type ExactRange } from './arithmetic.js';
import { computeEffort, computeCommercials, computeContingency } from './math.js';
import { calculateSchedule } from './schedule.js';
import { evaluateConfidence, minimumConfidence, type ConfidenceSignal } from './confidence.js';
type ItemSection = ArtifactSection & { payload: EstimateItem };
type Missing = EstimateItem['missingInputs'][number];
type Currency = { code: string; minorUnitDigits: number };
type Rate = { amount: number; currency: string; unit: string };
const zero = (unit: string): Range => ({ low: 0, high: 0, unit });
const known = <T>(value: T) => ({ state: 'KNOWN' as const, value });
const unknown = (reason: string) => ({ state: 'UNRESOLVED' as const, reason, questionIds: [] });
const numberValue = (value: number, unit: string) => ({ kind: 'NUMBER' as const, value, unit });
const textValue = (value: string) => ({ kind: 'TEXT' as const, value });
function uniqueInputs(inputs: InputRef[]) { return [...new Map(inputs.map(i => [hash([i.node, i.fields]), i])).values()]; }
/** Compare consumed values, never revision/review stamps; aliases retain their owner refs. */
function sameInputs(old: ArtifactSection | undefined, current: InputRef[]) {
  if (!old) return false;
  const prior = new Map(old.inputs.map(i => [canonicalJSON([i.node, i.fields]), i.valueHash]));
  return current.every(i => prior.get(canonicalJSON([i.node, i.fields])) === i.valueHash);
}
function exactStored(value: { low: string; high: string }): ExactRange { return { low: R(value.low), high: R(value.high) }; }
class Inputs {
  refs: InputRef[] = []; missing: Missing[] = [];
  constructor(readonly s: ScopingSession) {}
  get<T>(key: string, optional = false): T | null {
    const resolved = resolveConfig<T>(this.s, key); this.refs.push(...resolved.inputs);
    if (resolved.value === null && !optional) this.missing.push({ node: { kind: 'CONFIGURATION', id: 'CFG_01', key }, field: 'value', reason: resolved.reason! });
    return resolved.value;
  }
  gap(node: NodeRef, field: string, reason: string) { this.missing.push({ node, field, reason }); }
}
function driverValue(s: ScopingSession, input: InputRef) {
  if (input.node.kind !== 'CONFIGURATION') return null;
  const value = resolveConfig<unknown>(s, input.node.key).value;
  if (value !== null && typeof value !== 'boolean') throw new Error('Driver must resolve to a Boolean');
  return value as boolean | null;
}
function sourceEligible(s: ScopingSession, a: UnitSection, visited = new Set<string>()): boolean {
  if (visited.has(a.id)) return false;
  const source = a.payload.source;
  const ids = source.kind === 'DOMAIN' ? [source.sectionId] : source.kind === 'TEST_TARGET' ? [source.unitId] : source.kind === 'SOLUTION' ? [] : source.scopeRefs;
  for (const id of ids) {
    const record = s.artifactSections[id];
    if (!record || record.review !== 'REVIEWED' || record.reviewedRevision !== record.revision || record.lifecycle !== 'ACTIVE' || record.freshness !== 'CURRENT') return false;
    if (record.payload.kind === 'EstimationUnit' && !sourceEligible(s, record as UnitSection, new Set(visited).add(a.id))) return false;
  }
  return a.grounding.every(g => { const r = g.source.kind === 'Requirement' ? s.requirements[g.source.id] : s.assumptions[g.source.id]; return !!r && r.lifecycle === 'ACTIVE' && r.review === 'REVIEWED' && r.reviewedRevision === r.revision && (!('validation' in r) || r.validation !== 'UNVALIDATED'); });
}
function unitEligible(s: ScopingSession, a: UnitSection) {
  return a.lifecycle === 'ACTIVE' && a.review === 'REVIEWED' && a.reviewedRevision === a.revision && a.freshness === 'CURRENT' && sourceEligible(s, a);
}
/** Refresh engine-derived evidence after source acceptance. The unit's own reviewed
 * identity/boundary must still be intact; never review a proposed human boundary. */
function refreshUnitEvidence(s: ScopingSession) {
  for (const a of units(s).sort((a, b) => Number(a.payload.unitType === 'TESTING') - Number(b.payload.unitType === 'TESTING'))) {
    if (a.review !== 'REVIEWED' || a.reviewedRevision !== a.revision || a.lifecycle !== 'ACTIVE' || !sourceEligible(s, a)) continue;
    const sources = a.inputs.filter(i => i.node.kind === 'ArtifactSection' && i.fields.includes('payload'));
    if (sources.some(i => i.node.kind === 'ArtifactSection' && (!s.artifactSections[i.node.id] || s.artifactSections[i.node.id]!.review !== 'REVIEWED' || s.artifactSections[i.node.id]!.reviewedRevision !== s.artifactSections[i.node.id]!.revision || s.artifactSections[i.node.id]!.freshness !== 'CURRENT'))) continue;
    let changed = a.freshness !== 'CURRENT';
    a.inputs = a.inputs.map(i => {
      if (i.node.kind !== 'ArtifactSection') return i;
      const current = sectionRef(s, i.node.id, i.fields);
      if (i.valueHash === current.valueHash) return i;
      changed = true; return current;
    });
    const source = a.payload.source;
    const ids = source.kind === 'DOMAIN' ? [source.sectionId] : source.kind === 'TEST_TARGET' ? [source.unitId] : source.kind === 'SOLUTION' ? sources.flatMap(i => i.node.kind === 'ArtifactSection' ? [i.node.id] : []) : source.scopeRefs;
    const grounding = [...new Map(ids.flatMap(id => s.artifactSections[id]?.grounding ?? []).map(g => [`${g.source.kind}:${g.source.id}`, g])).values()];
    if (ids.length && hash(a.grounding) !== hash(grounding)) { a.grounding = grounding; changed = true; }
    if (changed) { a.freshness = 'CURRENT'; a.staleCauses = []; a.revision++; a.reviewedRevision = a.revision; a.lastChangedBy = 'ENGINE'; }
  }
}
function parameterKey(input: InputRef): string {
  if (input.node.kind !== 'CONFIGURATION') throw new Error('Estimation parameters require explicit configuration references');
  return input.node.key;
}
function normalizeInactive(s: ScopingSession) {
  for (const a of units(s).sort((a, b) => Number(a.payload.unitType === 'TESTING') - Number(b.payload.unitType === 'TESTING'))) {
    const p = a.payload, source = p.source;
    const target = source.kind === 'DOMAIN' ? s.artifactSections[source.sectionId] : source.kind === 'TEST_TARGET' ? s.artifactSections[source.unitId] : undefined;
    const excluded = a.lifecycle === 'RETIRED' || target?.lifecycle === 'RETIRED' || target?.payload.kind === 'Capability' && target.payload.inclusion === 'EXCLUDED' || target?.payload.kind === 'EstimationUnit' && target.payload.quantity.state === 'KNOWN' && target.payload.quantity.value === 0;
    if (excluded) { p.inclusion = known('EXCLUDED'); p.quantity = known(0); p.exclusionReason = 'Activity or authoritative source excluded/retired'; }
  }
}
export function deriveComplexity(s: ScopingSession) {
  const all = units(s);
  const derive = (a: UnitSection, shared: boolean | null) => {
    const p = a.payload; const original = hash(p.complexity);
    const flags = p.drivers.policy === 'FIXED_LOW' ? [] : p.drivers.flags.map(f => f.derivation ? shared : driverValue(s, f.inputs[0]!));
    const score = p.drivers.policy === 'FIXED_LOW' ? null : flags.some(v => v === null) ? null : flags.filter(Boolean).length;
    const band = p.drivers.policy === 'FIXED_LOW' ? 'LOW' : score === null ? null : score === 0 ? 'LOW' : score === 1 ? 'MEDIUM' : 'HIGH';
    p.complexity = { score, band: band ? known(band) : unknown('Required driver or upstream band/inventory unresolved'), rationale: p.drivers.policy === 'FIXED_LOW' ? 'FIXED_LOW policy; configured LOW multiplier is still required.' : `${flags.map(v => v === null ? 'unknown' : String(v)).join(', ')} → ${band ?? 'UNRESOLVED'}` };
    if (p.drivers.policy === 'THREE_FLAGS') for (const flag of p.drivers.flags) {
      if (flag.derivation) {
        flag.inputs = [...all.filter(u => ['INTEGRATION', 'DATA', 'AI'].includes(u.payload.unitType)).map(u => sectionRef(s, u.id, ['payload.complexity.band', 'payload.quantity', 'lifecycle'])), ...['INTEGRATION', 'DATA', 'AI'].map(t => configRef(s, `inventoryComplete.${t}`)), ref({ kind: 'COLLECTION', name: 'artifactSections' }, all.filter(u => ['INTEGRATION', 'DATA', 'AI'].includes(u.payload.unitType)).map(u => u.id), ['membership'], s.collectionCounters.artifactSections)];
      } else if (flag.inputs[0]!.node.kind === 'CONFIGURATION') flag.inputs = resolveConfig(s, flag.inputs[0]!.node.key).inputs;
    }
    p.baseEffortRef = configRef(s, parameterKey(p.baseEffortRef)); p.productivityRef = configRef(s, parameterKey(p.productivityRef)); p.roleAllocationRef = configRef(s, parameterKey(p.roleAllocationRef));
    a.inputs = uniqueInputs([...a.inputs.filter(i => i.node.kind !== 'CONFIGURATION' && i.node.kind !== 'RULESET'), p.baseEffortRef, p.productivityRef, p.roleAllocationRef, p.ruleSetRef, ...(p.drivers.policy === 'THREE_FLAGS' ? p.drivers.flags.flatMap(f => f.inputs) : [])]);
    if (p.complexity.band.state === 'KNOWN') a.inputs.push(configRef(s, `complexityMultipliers.${p.complexity.band.value}`));
    if (original !== hash(p.complexity)) { const reviewed = a.review === 'REVIEWED' && a.reviewedRevision === a.revision; a.revision++; if (reviewed) a.reviewedRevision = a.revision; }
  };
  all.filter(a => a.payload.unitType !== 'TESTING').forEach(a => derive(a, null));
  const upstream = all.filter(a => ['INTEGRATION', 'DATA', 'AI'].includes(a.payload.unitType) && !(a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 0));
  const high = upstream.some(a => a.payload.quantity.state === 'KNOWN' && a.payload.complexity.band.state === 'KNOWN' && a.payload.complexity.band.value === 'HIGH');
  const unresolved = upstream.some(a => a.payload.quantity.state !== 'KNOWN' || a.payload.complexity.band.state !== 'KNOWN') || ['INTEGRATION', 'DATA', 'AI'].some(t => resolveConfig<boolean>(s, `inventoryComplete.${t}`).value !== true);
  all.filter(a => a.payload.unitType === 'TESTING').forEach(a => derive(a, high ? true : unresolved ? null : false));
}
function signalsFor(s: ScopingSession, a: UnitSection, inputs: Inputs): ConfidenceSignal[] {
  const metrics = ['effort', 'timeline', 'commercials'] as const;
  const signals: ConfidenceSignal[] = [];
  const related = new Set<string>([a.id]);
  for (const g of a.grounding) {
    related.add(g.source.id);
    if (g.source.kind === 'Assumption') {
      const asm = s.assumptions[g.source.id];
      inputs.refs.push(ref(g.source, asm?.validation, ['validation'], asm?.revision ?? 0));
      if (asm?.validation !== 'CONFIRMED') signals.push({ severity: asm?.validation === 'PROVISIONAL' ? 'MEDIUM' : 'LOW', reason: `${g.source.id}: ${asm?.validation ?? 'missing'} assumption`, related: [g.source], metrics: [...metrics] });
    } else {
      const r = s.requirements[g.source.id];
      inputs.refs.push(ref(g.source, [r?.measures, r?.questionIds, r?.assumptionIds], ['measures', 'questionIds', 'assumptionIds'], r?.revision ?? 0));
      for (const id of r?.assumptionIds ?? []) {
        const asm = s.assumptions[id]; const node = { kind: 'Assumption' as const, id }; related.add(id);
        inputs.refs.push(ref(node, asm?.validation, ['validation'], asm?.revision ?? 0));
        if (asm?.validation !== 'CONFIRMED') signals.push({ severity: asm?.validation === 'PROVISIONAL' ? 'MEDIUM' : 'LOW', reason: `${id}: ${asm?.validation ?? 'missing'} assumption`, related: [node], metrics: [...metrics] });
      }
      for (const id of r?.questionIds ?? []) related.add(id);
      for (const [key, value] of Object.entries(r?.measures ?? {})) if (value.state === 'UNRESOLVED') signals.push({ severity: 'LOW', reason: `${r!.id}: unresolved material ${key}`, related: [g.source], metrics: [...metrics] });
    }
  }
  const linkedQuestions = Object.values(s.questions).filter(q => related.has(q.id) || q.related.some(n => 'id' in n && related.has(n.id)));
  inputs.refs.push(ref({ kind: 'COLLECTION', name: 'questions' }, linkedQuestions.map(q => q.id).sort(), ['membership'], s.collectionCounters.questions));
  for (const q of linkedQuestions) {
    inputs.refs.push(ref({ kind: 'Question', id: q.id }, [q.lifecycle, q.status, q.criticality, q.question, q.related], ['lifecycle', 'status', 'criticality', 'question', 'related'], q.revision));
    if (q.lifecycle === 'ACTIVE' && q.status === 'OPEN') signals.push({ severity: q.criticality === 'HIGH' ? 'LOW' : 'MEDIUM', reason: `${q.id}: ${q.question}`, related: [{ kind: 'Question', id: q.id }], metrics: [...metrics] });
  }
  if (a.payload.unitType === 'INTEGRATION' && inputs.get<boolean>(`readiness.${a.id}`, true) !== true) signals.push({ severity: 'LOW', reason: 'External integration readiness is unconfirmed; reviewed wait ranges are required for a full schedule.', related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: `readiness.${a.id}` }], metrics: [...metrics] });
  return signals;
}
function confidence(s: ScopingSession, c: Inputs, availability: { effort: boolean; timeline: boolean; commercials: boolean }, signals: ConfidenceSignal[], deadlineFeasibility: EstimateSummary['deadlineFeasibility'] = 'NOT_APPLICABLE') {
  const calibration = c.get<{ status: string }>('calibration', true);
  return evaluateConfidence({ availability, signals, calibrated: calibration ? calibration.status === 'CALIBRATED' : null, interfaceCount: units(s).filter(a => a.payload.unitType === 'INTEGRATION' && a.payload.quantity.state === 'KNOWN' && a.payload.quantity.value === 1).length, calibrationLimit: c.get<number>('supportedVolumeThreshold', true), contingencyPercent: c.get<number>('contingencyPercent', true), contingencyReviewThreshold: c.get<number>('contingencyReviewThreshold', true), deadlineFeasibility });
}
function store(s: ScopingSession, key: string, title: string, payload: EstimateItem | EstimateSummary, inputs: InputRef[], grounding: ArtifactSection['grounding'], now: string): ArtifactSection {
  const old = Object.values(s.artifactSections).find(a => a.sectionKey === key && a.payload.kind === payload.kind);
  const refs = uniqueInputs(inputs);
  // Revision metadata is historical provenance, not numerical identity.
  if (old && old.freshness === 'CURRENT' && hash([old.payload, old.inputs.map(i => [i.node, i.fields, i.valueHash]), old.grounding]) === hash([payload, refs.map(i => [i.node, i.fields, i.valueHash]), grounding])) return old;
  const artifact = estimateArtifact(s); const id = old?.id ?? allocateId(s, 'AS'); const revision = (old?.revision ?? 0) + 1;
  const section: ArtifactSection = { id, artifactId: artifact.id, sectionKey: key, title, payload, inputs: refs, grounding, origin: 'ASSUMED', revision, lifecycle: 'ACTIVE', review: 'REVIEWED', reviewedRevision: revision, reviewedAt: now, lastChangedBy: 'ENGINE', freshness: 'CURRENT', staleCauses: [] };
  s.artifactSections[id] = section; if (!old) { artifact.sectionIds.push(id); s.collectionCounters.artifactSections++; }
  return section;
}
export function calculateEstimate(input: ScopingSession, now: string, options: { mode?: 'SELECTIVE' | 'FULL' } = {}): ScopingSession {
  ConfigurationSchema.parse(input.configuration);
  const s = structuredClone(input); normalizeInactive(s); ScopingSessionSchema.parse(s); deriveComplexity(s); refreshUnitEvidence(s);
  const all = units(s); const records: { unit: UnitSection; section: ItemSection; exact: ExactRange | null; roles: Record<string, ExactRange> | null; blocked: boolean }[] = [];
  for (const a of all) {
    const p = a.payload; const c = new Inputs(s); const n = { kind: 'ArtifactSection', id: a.id } as const;
    const existing = Object.values(s.artifactSections).find((x): x is ItemSection => x.payload.kind === 'EstimateItem' && x.payload.unitId === a.id);
    // FULL is used by integrity audits to independently verify persisted calculated values.
    const previous = options.mode === 'FULL' ? undefined : existing?.payload;
    const unitInput = sectionRef(s, a.id, ['payload.unitType', 'payload.quantity', 'payload.complexity.band', 'payload.source.kind', ...(p.source.kind === 'DOMAIN' ? ['payload.source.sectionId'] : p.source.kind === 'TEST_TARGET' ? ['payload.source.unitId'] : p.source.kind === 'SOLUTION' ? ['payload.source.sessionId'] : ['payload.source.key'])]);
    c.refs.push(existing?.inputs.find(i => hash([i.node, i.fields, i.valueHash]) === hash([unitInput.node, unitInput.fields, unitInput.valueHash])) ?? unitInput, ruleRef());
    const inactive = p.quantity.state === 'KNOWN' && p.quantity.value === 0;
    const sharedEligible = p.unitType !== 'TESTING' || all.filter(u => ['INTEGRATION', 'DATA', 'AI'].includes(u.payload.unitType) && !(u.payload.quantity.state === 'KNOWN' && u.payload.quantity.value === 0)).every(u => unitEligible(s, u));
    const eligible = inactive || unitEligible(s, a) && sharedEligible;
    let numeric: ReturnType<typeof computeEffort> | null = null;
    const ledger: EstimateItem['ledger'] = [];
    const add = (step: string, values: EstimateItem['ledger'][number]['inputValues'], result: Range | null, refs: InputRef[] = c.refs) => ledger.push({ ruleStep: step, inputs: uniqueInputs(refs), inputValues: values, result });
    const currency = c.get<Currency>('currency');
    let base: Range | null = null, contingency: Range | null = null, total: Range | null = null, timeline: Range | null = null;
    const moneyLedger: EstimateItem['moneyLedger'] = [];
    let roles: Record<string, ExactRange> | null = null, exact: ExactRange | null = null;
    const sourceIdentity = p.source.kind === 'DOMAIN' ? p.source.sectionId : p.source.kind === 'TEST_TARGET' ? p.source.unitId : p.source.kind === 'SOLUTION' ? p.source.sessionId : p.source.key;
    add('Canonical unit / quantity / visible drivers / derived band', [textValue(a.id), textValue(p.unitType), textValue(sourceIdentity), textValue(p.complexity.rationale), ...(p.quantity.state === 'KNOWN' ? [numberValue(p.quantity.value, 'canonical-unit')] : [])], null, [c.refs[0]!]);
    if (inactive) { exact = exactRange(0, 0); roles = {}; base = zero('minor-units'); contingency = zero('minor-units'); total = zero('minor-units'); timeline = zero('working-days'); }
    else {
      if (a.review !== 'REVIEWED' || a.reviewedRevision !== a.revision || a.freshness !== 'CURRENT') c.gap(n, 'payload', 'Unit input review required; calculation blocked');
      if (!eligible) c.gap(n, 'payload.source', 'Source/grounding is not eligible for new calculation; historical current result retained');
      if (p.quantity.state !== 'KNOWN') c.gap(n, 'payload.quantity', 'Unknown applicability cannot become zero');
      if (p.complexity.band.state !== 'KNOWN') c.gap(n, 'payload.drivers', 'Required Boolean drivers or testing predicate unresolved');
      const baseline = c.get<Range>(parameterKey(p.baseEffortRef)), productivity = c.get<number>(parameterKey(p.productivityRef)), allocation = c.get<Record<string, number>>(parameterKey(p.roleAllocationRef));
      const multiplier = p.complexity.band.state === 'KNOWN' ? c.get<number>(`complexityMultipliers.${p.complexity.band.value}`) : null;
      if (eligible && baseline && productivity !== null && allocation && multiplier !== null && p.quantity.state === 'KNOWN' && a.review === 'REVIEWED' && a.reviewedRevision === a.revision && a.freshness === 'CURRENT') {
        const effortInputs = [c.refs[0]!, ruleRef(), ...[parameterKey(p.baseEffortRef), parameterKey(p.productivityRef), parameterKey(p.roleAllocationRef), `complexityMultipliers.${p.complexity.band.state === 'KNOWN' ? p.complexity.band.value : ''}`].flatMap(key => resolveConfig(s, key).inputs)];
        const reuseEffort = !!previous?.exactEffort && !!previous.exactRoleEffort && sameInputs(existing, effortInputs);
        numeric = reuseEffort ? { exact: exactStored(previous!.exactEffort!), effort: previous!.effort!, roles: Object.fromEntries(Object.entries(previous!.exactRoleEffort!).map(([role, value]) => [role, exactStored(value)])) } : computeEffort(baseline, multiplier, productivity, allocation); exact = numeric.exact; roles = numeric.roles;
        if (reuseEffort) ledger.push(...previous!.ledger.filter(l => l.ruleStep.startsWith('E = ') || l.ruleStep.includes(': effort × allocation')));
        else {
        add('E = quantity × unadjusted baseline × selected multiplier ÷ productivity (one adjustment)', [numberValue(1, 'canonical-unit'), numberValue(baseline.low, 'person-days/unit'), numberValue(baseline.high, 'person-days/unit'), numberValue(multiplier, 'scalar'), numberValue(productivity, 'scalar'), textValue(`exact effort ${exact.low} .. ${exact.high}`)], numeric.effort, effortInputs);
        for (const [role, days] of Object.entries(roles)) add(`Role ${role}: effort × allocation`, [numberValue(allocation[role]!, 'share'), textValue(`exact role days ${days.low} .. ${days.high}`)], range(days, 'person-days'), effortInputs);
        }
        const capacities: Record<string, number> = {}; const rates: Record<string, number> = {};
        for (const role of Object.keys(roles)) {
          const capacity = c.get<number>(`capacity.${role}`); if (capacity !== null && capacity > 0) capacities[role] = capacity; else if (capacity === 0) c.gap({ kind: 'CONFIGURATION', id: 'CFG_01', key: `capacity.${role}` }, 'value', 'Zero capacity makes used-role duration unavailable');
          const rate = c.get<Rate>(`rates.${role}`);
          if (rate && currency && rate.currency === currency.code) {
            if (rate.unit !== 'minor-units/person-day' || !Number.isSafeInteger(rate.amount) || rate.amount <= 0) throw new Error(`Invalid rate ${role}`);
            rates[role] = rate.amount;
            const oldRow = previous?.moneyLedger.find(row => row.roleId === role && row.metric === 'BASE');
            const reuseRow = reuseEffort && !!oldRow && sameInputs(existing, [...resolveConfig(s, `rates.${role}`).inputs, ...resolveConfig(s, 'currency').inputs]);
            const row = reuseRow ? oldRow : computeCommercials({ [role]: roles[role]! }, { [role]: rate.amount }, 0).lines[0]!;
            moneyLedger.push({ unitId: a.id, ...row, metric: 'BASE', currency: currency.code });
            const oldLedger = previous?.ledger.find(l => l.ruleStep === `Role ${role}: outward-round(role days × rate) in minor units`);
            if (reuseRow && oldLedger) ledger.push(oldLedger);
            else add(`Role ${role}: outward-round(role days × rate) in minor units`, [numberValue(rate.amount, `${currency.code} minor-units/person-day`)], row.cost, [...effortInputs, ...resolveConfig(s, `rates.${role}`).inputs, ...resolveConfig(s, 'currency').inputs]);
          } else if (rate && currency) c.gap({ kind: 'CONFIGURATION', id: 'CFG_01', key: `rates.${role}` }, 'value', `Rate currency ${rate.currency} does not match ${currency.code}; explicitly replace/confirm rate, no FX`);
        }
        if (Object.keys(capacities).length === Object.keys(roles).length) timeline = reuseEffort && previous!.timeline && sameInputs(existing, Object.keys(roles).flatMap(role => resolveConfig(s, `capacity.${role}`).inputs)) ? previous!.timeline : { low: Math.max(...Object.entries(roles).map(([r, d]) => outward(d.low.div(R(capacities[r]!)), 'high'))), high: Math.max(...Object.entries(roles).map(([r, d]) => outward(d.high.div(R(capacities[r]!)), 'high'))), unit: 'working-days' };
        const percent = c.get<number>('contingencyPercent');
        if (Object.keys(rates).length === Object.keys(roles).length && currency) {
          const reuseBase = previous?.commercials.base && hash(moneyLedger) === hash(previous.moneyLedger);
          base = reuseBase ? previous!.commercials.base! : range(sumExact(moneyLedger.map(row => exactRange(row.cost.low, row.cost.high))), 'minor-units');
          if (percent !== null) {
            const reuseContingency = reuseBase && !!previous?.commercials.contingency && !!previous.commercials.total && sameInputs(existing, resolveConfig(s, 'contingencyPercent').inputs);
            const priced = reuseContingency ? previous!.commercials : computeContingency(base, percent); contingency = priced.contingency!; total = priced.total;
            const oldLedger = previous?.ledger.find(l => l.ruleStep.startsWith('Unit contingency'));
            if (reuseContingency && oldLedger) ledger.push(oldLedger);
            else add('Unit contingency = outward-round(unit base × contingency / 100); ROM = base + contingency', [numberValue(percent, 'percent'), numberValue(base.low, 'minor-units'), numberValue(base.high, 'minor-units'), numberValue(contingency.low, 'minor-units'), numberValue(contingency.high, 'minor-units')], total, [...effortInputs, ...Object.keys(roles).flatMap(role => resolveConfig(s, `rates.${role}`).inputs), ...resolveConfig(s, 'currency').inputs, ...resolveConfig(s, 'contingencyPercent').inputs]);
          }
        }
      }
    }
    const effort = exact ? range(exact, 'person-days') : null;
    const signals = inactive ? [] : signalsFor(s, a, c);
    const conf = confidence(s, c, { effort: !!effort, timeline: !!timeline, commercials: !!total }, signals);
    const payload: EstimateItem = { kind: 'EstimateItem', unitId: a.id, ruleSet: { id: RULESET.id, version: RULESET.version, hash: RULESET.hash }, effort, timeline, roleEffort: roles ? Object.entries(roles).map(([roleId, value]) => ({ roleId, effort: range(value, 'person-days') })) : [], commercials: { currency: currency?.code ?? null, minorUnitDigits: currency?.minorUnitDigits ?? null, base, contingency, total }, resultStatus: effort && timeline && total ? 'COMPLETE' : effort || total ? 'PARTIAL' : 'UNAVAILABLE', ...conf, missingInputs: c.missing, ledger, moneyLedger };
    payload.exactEffort = exact ? { low: exact.low.toString(), high: exact.high.toString() } : null;
    payload.exactRoleEffort = Object.fromEntries(Object.entries(roles ?? {}).map(([role, value]) => [role, { low: value.low.toString(), high: value.high.toString() }]));
    const section = (!eligible && existing ? existing : store(s, `estimate:${a.id}`, `Calculation: ${a.id}`, payload, c.refs, a.grounding, now)) as ItemSection;
    records.push({ unit: a, section, exact, roles, blocked: !eligible });
  }
  const c = new Inputs(s); c.refs.push(ruleRef(), ...all.map(a => sectionRef(s, a.id, ['payload.workstreamId', 'payload.inclusion', 'payload.quantity', 'lifecycle'])), ref({ kind: 'COLLECTION', name: 'artifactSections' }, all.map(a => a.id).sort(), ['membership'], s.collectionCounters.artifactSections));
  const active = records.filter(r => !(r.unit.payload.quantity.state === 'KNOWN' && r.unit.payload.quantity.value === 0));
  for (const r of active.filter(r => r.blocked)) c.gap({ kind: 'ArtifactSection', id: r.unit.id }, 'payload.source', 'Input is not eligible for new calculation; prior result retained and excluded from current totals');
  let inventoryComplete = true;
  for (const type of PRIMARY) if (c.get<boolean>(`inventoryComplete.${type}`) !== true) { inventoryComplete = false; c.gap({ kind: 'CONFIGURATION', id: 'CFG_01', key: `inventoryComplete.${type}` }, 'value', 'Incomplete primary inventory suppresses full totals; known subtotal only'); }
  const effortExact = sumExact(active.flatMap(r => r.exact ? [r.exact] : []));
  const effort = inventoryComplete && active.every(r => r.exact) ? range(effortExact, 'person-days') : null;
  const sumMoney = (key: 'base' | 'contingency' | 'total') => { const values = active.flatMap(r => !r.blocked && r.section.payload.commercials[key] ? [r.section.payload.commercials[key]!] : []); return range(sumExact(values.map(v => exactRange(v.low, v.high))), 'minor-units'); };
  const currency = c.get<Currency>('currency');
  const commercials = { currency: currency?.code ?? null, minorUnitDigits: currency?.minorUnitDigits ?? null, base: inventoryComplete && active.every(r => r.section.payload.commercials.base) ? sumMoney('base') : null, contingency: inventoryComplete && active.every(r => r.section.payload.commercials.contingency) ? sumMoney('contingency') : null, total: inventoryComplete && active.every(r => r.section.payload.commercials.total) ? sumMoney('total') : null };
  if (active.some(r => r.blocked)) { commercials.base = null; commercials.contingency = null; commercials.total = null; }
  const workstreams = Object.values(s.artifactSections).flatMap(a => a.payload.kind === 'Workstream' && a.lifecycle === 'ACTIVE' ? [{ id: a.id, phaseKey: a.payload.phaseKey, phaseOrder: a.payload.phaseOrder, predecessorRefs: a.payload.predecessorRefs, milestones: a.payload.milestones }] : []);
  const roleIds = [...new Set(active.flatMap(r => Object.keys(r.roles ?? {})))].sort();
  const capacities = Object.fromEntries(roleIds.map(role => [role, c.get<number>(`capacity.${role}`)]));
  const phaseKeys = [...new Set(workstreams.filter(w => active.some(r => r.unit.payload.workstreamId === w.id)).map(w => w.phaseKey))];
  const phaseMinimums = Object.fromEntries(phaseKeys.map(k => [k, c.get<number>(`phaseMinimumDays.${k}`)]));
  const waits = Object.fromEntries(phaseKeys.map(k => [k, c.get<Range>(`wait.${k}`)]));
  // A workstream may explicitly consume a separate prerequisite wait. Independent
  // prerequisites combine by maximum, once at the phase barrier.
  for (const a of Object.values(s.artifactSections)) if (a.payload.kind === 'Workstream' && phaseKeys.includes(a.payload.phaseKey) && a.payload.waitInput) {
    const n = a.payload.waitInput.node; const extra = n.kind === 'CONFIGURATION' ? c.get<Range>(n.key) : null; const current = waits[a.payload.phaseKey];
    waits[a.payload.phaseKey] = extra && current ? { low: Math.max(extra.low, current.low), high: Math.max(extra.high, current.high), unit: 'working-days' } : null;
  }
  const startDate = c.get<string>('startDate'), workingWeekdays = c.get<number[]>('workingWeekdays'), holidays = c.get<string[]>('holidays');
  const deadline = c.get<string>('deliveryDeadline', true); const deadlineRequired = !!s.configuration.entries.deliveryDeadline && !(s.configuration.entries.deliveryDeadline.kind === 'VALUE' && s.configuration.entries.deliveryDeadline.value.state === 'NOT_APPLICABLE');
  const previousSummary = Object.values(input.artifactSections).find(a => a.payload.kind === 'EstimateSummary');
  const oldSummary = previousSummary?.payload.kind === 'EstimateSummary' ? previousSummary.payload : undefined;
  const scheduleKeys = [...roleIds.map(role => `capacity.${role}`), ...phaseKeys.flatMap(key => [`phaseMinimumDays.${key}`, `wait.${key}`]), 'startDate', 'workingWeekdays', 'holidays', 'deliveryDeadline'];
  const scheduleInputs = [ruleRef(), ...scheduleKeys.flatMap(key => resolveConfig(s, key).inputs), ...all.map(a => sectionRef(s, a.id, ['payload.workstreamId', 'payload.inclusion', 'payload.quantity', 'lifecycle'])), ...workstreams.map(w => sectionRef(s, w.id, ['payload.phaseKey', 'payload.phaseOrder', 'payload.predecessorRefs', 'payload.milestones', 'payload.waitInput']))];
  for (const a of Object.values(s.artifactSections)) if (a.payload.kind === 'Workstream' && a.payload.waitInput?.node.kind === 'CONFIGURATION') scheduleInputs.push(...resolveConfig(s, a.payload.waitInput.node.key).inputs);
  const sameRoles = active.every(r => {
    const old = input.artifactSections[r.section.id];
    return !r.blocked && old?.payload.kind === 'EstimateItem' && hash(old.payload.exactRoleEffort) === hash(r.section.payload.exactRoleEffort);
  });
  // Reuse a complete physical schedule only when all role loads, membership, ownership,
  // calendar and scheduling inputs are unchanged. Commercial changes are absent here.
  const scheduleEligible = Object.values(capacities).every(value => value !== null && value > 0) && Object.values(phaseMinimums).every(value => value !== null) && Object.values(waits).every(value => value !== null) && startDate !== null && workingWeekdays !== null && holidays !== null && (!deadlineRequired || deadline !== null);
  const reuseSchedule = options.mode !== 'FULL' && scheduleEligible && inventoryComplete && !!oldSummary?.workingDuration && !!oldSummary.calendarDuration && sameRoles && hash(oldSummary.estimateIds) === hash(active.map(r => r.section.id)) && sameInputs(previousSummary, scheduleInputs);
  const schedule = reuseSchedule ? {
    phases: oldSummary.phases, workingDuration: oldSummary.workingDuration, calendarDuration: oldSummary.calendarDuration,
    startDate: oldSummary.startDate ?? null, finishDates: oldSummary.finishDates ?? null, deadlineFeasibility: oldSummary.deadlineFeasibility,
    missing: oldSummary.missingInputs.filter(m => m.reason.startsWith('Schedule: ') && m.node.kind === 'CONFIGURATION').map(m => m.node.kind === 'CONFIGURATION' ? m.node.key : ''),
    limitations: oldSummary.limitations.filter(l => l.related.length === 0 && (l.reason.startsWith('Sequential phases') || l.reason.startsWith('The execution subtotal'))).map(l => l.reason),
  } : calculateSchedule({ units: active.map(r => ({ unitId: r.unit.id, estimateId: r.section.id, workstreamId: r.unit.payload.workstreamId, roles: r.roles })), workstreams, capacities, phaseMinimums, waits, startDate, workingWeekdays, holidays, deadline, deadlineRequired });
  const workingDuration = inventoryComplete ? schedule.workingDuration : null;
  for (const missing of schedule.missing) c.gap({ kind: 'CONFIGURATION', id: 'CFG_01', key: missing }, 'value', `Schedule: ${missing}`);
  const calendarDuration = workingDuration ? schedule.calendarDuration : null;
  const summarySignals: ConfidenceSignal[] = active.flatMap(r => (['effort', 'timeline', 'commercials'] as const).flatMap(metric => r.section.payload.confidenceByMetric[metric] === 'HIGH' ? [] : [{ severity: r.section.payload.confidenceByMetric[metric] as 'LOW' | 'MEDIUM', metrics: [metric], reason: `${r.unit.id}: ${metric} confidence ${r.section.payload.confidenceByMetric[metric]}`, related: [{ kind: 'ArtifactSection' as const, id: r.unit.id }] }]));
  const conf = confidence(s, c, { effort: !!effort, timeline: !!workingDuration && !!calendarDuration, commercials: !!commercials.total }, summarySignals, schedule.deadlineFeasibility);
  const days = c.get<number>('daysPerPersonWeek'), effortQuantum = c.get<number>('effortRounding'), calendarQuantum = c.get<number>('calendarRounding'), commercialQuantum = c.get<number>('commercialRounding');
  const summary: EstimateSummary = { kind: 'EstimateSummary', estimateIds: active.map(r => r.section.id), effort, timeline: workingDuration, roleEffort: roleIds.map(roleId => ({ roleId, effort: inventoryComplete && active.every(r => r.roles) ? range(sumExact(active.flatMap(r => r.roles?.[roleId] ? [r.roles[roleId]!] : [])), 'person-days') : null })), commercials, resultStatus: effort && workingDuration && calendarDuration && commercials.total ? 'COMPLETE' : active.some(r => r.exact) ? 'PARTIAL' : 'UNAVAILABLE', ...conf, missingInputs: [...c.missing, ...active.flatMap(r => r.section.payload.missingInputs)], limitations: [...conf.limitations, ...active.flatMap(r => r.section.payload.limitations), ...schedule.limitations.map(reason => ({ reason, related: [] }))], phases: schedule.phases, workingDuration, calendarDuration, startDate: schedule.startDate, finishDates: workingDuration ? schedule.finishDates : null, deadlineFeasibility: !inventoryComplete && deadlineRequired ? 'UNAVAILABLE' : schedule.deadlineFeasibility, moneyLedger: active.flatMap(r => r.section.payload.moneyLedger), knownSubtotals: { effort: range(effortExact, 'person-days'), base: sumMoney('base'), contingency: sumMoney('contingency'), total: sumMoney('total') }, presentation: { personWeeks: effort && days && effortQuantum ? headline({ low: effortExact.low.div(R(days)), high: effortExact.high.div(R(days)) }, effortQuantum, 'person-weeks') : null, calendarWeeks: calendarDuration && calendarQuantum ? headline({ low: R(calendarDuration.low).div(R(7)), high: R(calendarDuration.high).div(R(7)) }, calendarQuantum, 'calendar-weeks') : null, rom: commercials.total && currency && commercialQuantum ? headline({ low: R(commercials.total.low).div(R(10 ** currency.minorUnitDigits)), high: R(commercials.total.high).div(R(10 ** currency.minorUnitDigits)) }, commercialQuantum, currency.code) : null }, ledger: [{ ruleStep: 'Sum distinct canonical unit IDs; no group complexity, reallocation or contingency', inputs: active.map(r => sectionRef(s, r.section.id, ['payload.effort', 'payload.commercials'])), inputValues: [textValue(`exact effort ${effortExact.low} .. ${effortExact.high}`), ...active.map(r => textValue(r.unit.id))], result: effort }, ...schedule.phases.map(p => ({ ruleStep: `Phase ${p.key}: ceil(max(minimum, pooled role days / capacity)); wait added once`, inputs: c.refs, inputValues: [textValue(JSON.stringify({ roleLoads: p.roleLoads, capacities, minimum: phaseMinimums[p.key], wait: p.wait, limitingRoles: p.limitingRoles }))], result: p.duration }))] };
  c.refs.push(...active.map(r => sectionRef(s, r.section.id, ['payload.effort', 'payload.roleEffort', 'payload.commercials', 'payload.confidenceByMetric'])), ...workstreams.map(w => sectionRef(s, w.id, ['payload.phaseKey', 'payload.phaseOrder', 'payload.predecessorRefs', 'payload.milestones', 'payload.waitInput'])));
  store(s, 'estimate:summary', 'Solution estimate', summary, c.refs, [], now);
  return s;
}
export function estimateView(s: ScopingSession) {
  const itemSections = Object.values(s.artifactSections).filter((a): a is ItemSection => a.payload.kind === 'EstimateItem' && a.lifecycle === 'ACTIVE').sort((a, b) => a.payload.unitId.localeCompare(b.payload.unitId));
  const summarySection = Object.values(s.artifactSections).find(a => a.payload.kind === 'EstimateSummary');
  const summary = summarySection?.payload.kind === 'EstimateSummary' ? summarySection.payload : null;
  const all = units(s);
  const workstreams = Object.values(s.artifactSections).flatMap(a => {
    if (a.payload.kind !== 'Workstream') return [];
    const members = all.filter(u => u.payload.workstreamId === a.id && !(u.payload.quantity.state === 'KNOWN' && u.payload.quantity.value === 0));
    const items = itemSections.filter(i => members.some(u => u.id === i.payload.unitId));
    const complete = items.length === members.length && items.every(i => i.payload.exactEffort);
    const roles = [...new Set(items.flatMap(i => Object.keys(i.payload.exactRoleEffort ?? {})))].sort();
    return [{ id: a.id, name: a.payload.name, phase: a.payload.phaseKey, unitIds: members.map(u => u.id), confidence: minimumConfidence(items.map(i => i.payload.confidence)), effort: complete ? range(sumExact(items.map(i => ({ low: R(i.payload.exactEffort!.low), high: R(i.payload.exactEffort!.high) }))), 'person-days') : null, roleEffort: roles.map(roleId => ({ roleId, effort: complete ? range(sumExact(items.flatMap(i => { const v = i.payload.exactRoleEffort?.[roleId]; return v ? [{ low: R(v.low), high: R(v.high) }] : []; })), 'person-days') : null })), commercials: items.length === members.length && items.every(i => i.payload.commercials.total) ? range(sumExact(items.map(i => exactRange(i.payload.commercials.total!.low, i.payload.commercials.total!.high))), 'minor-units') : null }];
  });
  return { units: all, items: itemSections, summary, workstreams };
}
