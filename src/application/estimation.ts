import { z } from 'zod';
import type { SessionRepository } from '../persistence/repository.js';
import { ConfigurationSchema, ScopingSessionSchema, type ScopingSession } from '../domain/index.js';
import { parseCommand } from './scope.js';
import { canGenerateDownstream } from './scope-review.js';
import { artifactEligible } from './deliverable-inputs.js';
import { ConflictError, ValidationError } from './errors.js';
import { demoConfiguration, setConfig, PRIMARY, hash } from '../estimation/config.js';
import { reconcileUnits, addBoundary, reviewUnits, units } from '../estimation/reconcile.js';
import { calculateEstimate, estimateView } from '../estimation/engine.js';
import { estimationCoverage } from '../traceability/estimation.js';
import { applyImpact } from '../impact/index.js';
const command = z.object({ expectedRevision: z.number().int().positive() }).strict();
const review = command.extend({ confirmed: z.literal(true) });
const configuration = review.extend({ updates: z.array(z.object({ key: z.string().min(1), value: z.unknown(), basis: z.string().trim().min(1) }).strict()).nonempty() });
const boundary = command.extend({ unitType: z.enum(['DATA', 'CLOUD']), name: z.string().trim().min(1), boundary: z.string().trim().min(1), scopeRefs: z.array(z.string()).nonempty() });
const editUnit = review.extend({ inclusion: z.enum(['INCLUDED', 'EXCLUDED']).optional(), exclusionReason: z.string().trim().min(1).optional(), workstreamId: z.string().optional(), name: z.string().trim().min(1).optional(), boundary: z.string().trim().min(1).optional() });
function gate(s: ScopingSession) {
  const status = canGenerateDownstream(s); if (!status.eligible) throw new ValidationError(status.reasons.join(' '), ['scope']);
  const sources = Object.values(s.artifactSections).filter(a => ['Workstream', 'Capability', 'ArchitectureComponent', 'DataDomain', 'Integration', 'AIUseCase'].includes(a.payload.kind) && a.lifecycle === 'ACTIVE');
  if (!sources.some(a => a.payload.kind === 'Workstream')) throw new ValidationError('Accept a delivery plan before estimation.', ['artifacts']);
  for (const a of sources) if (!artifactEligible(s, a)) throw new ValidationError(`${a.id}: accept current scope/design/delivery inputs before estimation.`, ['artifacts', a.id]);
}
export class EstimationCommands {
  constructor(private readonly repository: SessionRepository) {}
  private async change(id: string, expectedRevision: number, operation: (s: ScopingSession) => ScopingSession) {
    const current = await this.repository.load(id); if (current.revision !== expectedRevision) throw new ConflictError(); gate(current);
    let next: ScopingSession;
    try { next = operation(structuredClone(current)); ScopingSessionSchema.parse(next); }
    catch (error) { if (error instanceof ValidationError) throw error; throw new ValidationError(error instanceof Error ? error.message : 'Invalid estimation input.', ['estimate']); }
    next.revision = expectedRevision + 1; delete next.gate; delete next.exportReceipt;
    if (next.lastImpact?.changeId === current.lastImpact?.changeId || !next.lastImpact) applyImpact(current, next);
    await this.repository.save(next, expectedRevision); return next;
  }
  async prepare(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(command, input);
    return this.change(id, expectedRevision, source => {
      const demo = demoConfiguration();
      for (const [key, value] of Object.entries(demo.entries)) if (!source.configuration.entries[key]) source.configuration.entries[key] = value;
      for (const a of Object.values(source.artifactSections)) if (a.payload.kind === 'Workstream') {
        for (const [key, value] of [[`phaseMinimumDays.${a.payload.phaseKey}`, 2], [`wait.${a.payload.phaseKey}`, { low: 0, high: 0, unit: 'working-days' }]] as const) if (!source.configuration.entries[key]) setConfig(source, key, value, 'Proposed DEMO schedule assumption: minimum 2 days, no external wait; reviewer must validate.', false);
      }
      let s = reconcileUnits(source);
      // Named environments are explicitly proposed assumptions. They are not one
      // billable row per architecture node and cannot calculate before review.
      const architecture = Object.values(s.artifactSections).filter(a => a.payload.kind === 'ArchitectureComponent' && a.lifecycle === 'ACTIVE').map(a => a.id);
      if (architecture.length && !units(s).some(a => a.payload.unitType === 'CLOUD')) for (const name of ['Development', 'Test', 'Production']) s = addBoundary(s, { unitType: 'CLOUD', name, boundary: `Proposed ${name.toLowerCase()} environment provisioning and release preparation; validate this boundary.`, scopeRefs: architecture });
      for (const a of units(s)) {
        if (a.payload.unitType === 'SECURITY' && a.payload.inclusion.state !== 'KNOWN') a.payload.inclusion = { state: 'KNOWN', value: 'INCLUDED' };
        if (a.payload.drivers.policy === 'THREE_FLAGS') for (const [i, f] of a.payload.drivers.flags.entries()) if (!f.derivation) {
          const n = f.inputs[0]!.node;
          if (n.kind === 'CONFIGURATION') {
            const e = s.configuration.entries[n.key];
            if (e?.kind === 'VALUE' && e.value.state === 'UNRESOLVED' && e.revision === 1) setConfig(s, n.key, i === 0, 'PROPOSED DEMO DRIVER ASSUMPTION: first flag true, other flags false. Not inferred customer facts; inspect and edit before accepting.', false);
          }
        }
      }
      // Completeness stays explicitly proposed until the reviewer accepts the
      // visible inventory. No migration packages are inferred from data domains.
      s = reconcileUnits(s);
      for (const t of PRIMARY) { const key = `inventoryComplete.${t}`; const e = s.configuration.entries[key]; if (e?.validation !== 'VALIDATED') setConfig(s, key, true, `Proposed completeness of displayed ${t} inventory, including explicit none where no units are shown. Add omitted boundaries before accepting.`, false); }
      if (s.seedId === 'missing-information' || s.seedId === 'missing') setConfig(s, 'rates.E', null, 'Missing-information seed: engineering rate has not been supplied.', false);
      s.configuration.revision++; return s;
    });
  }
  async reconcile(id: string, input: unknown) { const { expectedRevision } = parseCommand(command, input); return this.change(id, expectedRevision, reconcileUnits); }
  async addBoundary(id: string, input: unknown) { const { expectedRevision, ...args } = parseCommand(boundary, input); return this.change(id, expectedRevision, s => addBoundary(s, args)); }
  async review(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(review, input);
    return this.change(id, expectedRevision, s => {
      for (const e of Object.values(s.configuration.entries)) e.validation = 'VALIDATED';
      s = reconcileUnits(s);
      for (const e of Object.values(s.configuration.entries)) e.validation = 'VALIDATED';
      s.configuration.revision++; return reviewUnits(s, new Date().toISOString());
    });
  }
  async calculate(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(command, input);
    return this.change(id, expectedRevision, s => calculateEstimate(s, new Date().toISOString()));
  }
  async configure(id: string, input: unknown) {
    const { expectedRevision, updates } = parseCommand(configuration, input);
    return this.change(id, expectedRevision, s => {
      if (new Set(updates.map(u => u.key)).size !== updates.length) throw new ValidationError('Duplicate configuration key.', ['updates']);
      const before = structuredClone(s);
      const priorCurrency = hash(s.configuration.entries.currency);
      for (const u of updates) setConfig(s, u.key, u.value, u.basis, true);
      ConfigurationSchema.parse(s.configuration);
      if (updates.some(u => u.key === 'currency') && hash(s.configuration.entries.currency) !== priorCurrency) {
        for (const [key, e] of Object.entries(s.configuration.entries)) if (key.startsWith('rates.') && !updates.some(u => u.key === key)) { e.validation = 'UNVALIDATED'; e.revision++; }
      }
      s.configuration.revision++;
      s.revision = expectedRevision + 1;
      applyImpact(before, s);
      const result = estimateView(s).summary ? calculateEstimate(s, new Date().toISOString()) : s;
      if (result.lastImpact) result.lastImpact.staleTargets = result.lastImpact.staleTargets.filter(n => n.kind !== 'ArtifactSection' || result.artifactSections[n.id]?.freshness === 'STALE');
      return result;
    });
  }
  async editUnit(id: string, unitId: string, input: unknown) {
    const { expectedRevision, ...edit } = parseCommand(editUnit, input);
    return this.change(id, expectedRevision, s => {
      const a = units(s).find(u => u.id === unitId); if (!a) throw new ValidationError('Canonical unit not found.', ['unitId']);
      if (edit.inclusion) {
        if (a.payload.source.kind === 'DOMAIN' || a.payload.source.kind === 'TEST_TARGET' || ['DISCOVERY', 'HANDOVER', 'TESTING'].includes(a.payload.unitType)) throw new ValidationError('Inclusion is derived from the accepted source. Edit/review the source first.', ['inclusion']);
        if (edit.inclusion === 'EXCLUDED' && !edit.exclusionReason) throw new ValidationError('Exclusion requires a reason.', ['exclusionReason']);
        a.payload.inclusion = { state: 'KNOWN', value: edit.inclusion }; if (edit.exclusionReason) a.payload.exclusionReason = edit.exclusionReason;
      }
      if (edit.workstreamId) { if (s.artifactSections[edit.workstreamId]?.payload.kind !== 'Workstream') throw new ValidationError('Workstream required.', ['workstreamId']); a.payload.workstreamId = edit.workstreamId; }
      if (edit.name || edit.boundary) {
        const p = a.payload.source; if (p.kind !== 'ENVIRONMENT' && p.kind !== 'MIGRATION_PACKAGE') throw new ValidationError('Only named boundaries can be edited here.');
        if (edit.name) { p.name = edit.name; a.title = edit.name; } if (edit.boundary) p.boundary = edit.boundary;
      }
      a.revision++; a.review = 'PROPOSED'; delete a.reviewedAt; delete a.reviewedRevision;
      return reconcileUnits(s);
    });
  }
  async read(id: string) { const s = await this.repository.load(id); return { ...estimateView(s), coverage: estimationCoverage(s), eligible: canGenerateDownstream(s).eligible }; }
}
