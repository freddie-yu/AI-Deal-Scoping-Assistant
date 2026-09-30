import { z } from 'zod';
import type { SessionRepository } from '../persistence/repository.js';
import { text, RequirementSchema, AssumptionSchema, ClarificationQuestionSchema, type ScopingSession, type Requirement, type Assumption, type ClarificationQuestion } from '../domain/index.js';
import { allocateId } from '../domain/ids.js';
import type { AIProvider } from '../ai/provider.js';
import { MockAIProvider } from '../ai/mock.js';
import { validateProposal } from '../validation/provider.js';
import { AnalysisProposalSchema } from '../domain/analysis.js';
import { validateAnalysis } from '../validation/analysis.js';
import { canonicalizeAnalysis } from './canonicalize.js';
import { scopeFingerprint, scopeReadiness, scopeStatus } from './scope-review.js';
import { activeRecord, changed, rememberEdit, validateScopeRecord, RevisionCommandSchema, RequirementEditSchema, AssumptionEditSchema, AnswerCommandSchema, type ScopeCollection } from './scope-edits.js';
import { addSource } from '../ingestion/sources.js';
import { ConflictError, ValidationError } from './errors.js';
import { applyImpact } from '../impact/index.js';

export const InputCommandSchema = z.object({ expectedRevision: z.number().int().positive(), title: text.max(200), text: z.string().max(60000).refine(v => !!v.trim(), 'Enter customer requirements.'), inputKind: z.enum(['PASTED_TEXT', 'PASTED_MARKDOWN']) }).strict();
export function parseCommand<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '), result.error.issues.map(i => i.path.join('.')));
  return result.data;
}
export class ScopeCommands {
  constructor(private readonly repository: SessionRepository, private readonly provider: AIProvider = new MockAIProvider()) {}
  private async snapshot(id: string, expectedRevision: number) {
    const session = await this.repository.load(id);
    if (session.revision !== expectedRevision) throw new ConflictError();
    return session;
  }
  private async commit(session: ScopingSession, expectedRevision: number, approved = false) {
    const before = await this.snapshot(session.id, expectedRevision);
    session.revision = expectedRevision + 1; session.scopeReviewFingerprint = approved ? scopeFingerprint(session) : null;
    applyImpact(before, session);
    delete session.gate; delete session.exportReceipt;
    await this.repository.save(session, expectedRevision); return session;
  }
  async saveInput(id: string, input: unknown) {
    const { expectedRevision, ...source } = parseCommand(InputCommandSchema, input);
    const session = await this.snapshot(id, expectedRevision);
    addSource(session, source);
    return this.commit(session, expectedRevision);
  }
  async analyze(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(RevisionCommandSchema, input);
    const session = await this.snapshot(id, expectedRevision);
    const snapshot = structuredClone(session);
    const result = await this.provider.generate({ operation: 'analyze', context: snapshot, schemaVersion: '1', requestedItemIds: [], fixtureVariant: 'scope' });
    if (result.metadata.mode !== 'MOCK') throw new ValidationError('Only MOCK analysis is enabled.', ['providerMode']);
    const validated = await validateProposal(result, AnalysisProposalSchema, [proposal => validateAnalysis(session, proposal)]);
    canonicalizeAnalysis(session, validated.proposal, validated.metadata);
    // Repository compare-and-save rechecks the captured revision after provider work.
    return this.commit(session, expectedRevision);
  }
  async readScope(id: string) { return scopeStatus(await this.repository.load(id)); }
  async editRequirement(id: string, requirementId: string, input: unknown) {
    const { expectedRevision, patch } = parseCommand(RequirementEditSchema, input);
    const session = await this.snapshot(id, expectedRevision); const old = activeRecord(session.requirements, requirementId); const before = structuredClone(old);
    const next = { ...old, ...patch };
    if (next.origin === 'CUSTOMER_STATED' && old.origin !== 'CUSTOMER_STATED' && (Object.keys(next.measures ?? {}).length > 0 || next.technologyConstraints?.length)) throw new ValidationError('Structured inferred/assumed facts cannot be relabeled as customer-stated. Re-analyze customer evidence to create directly supported structured facts.', ['origin']);
    if (next.origin === 'CUSTOMER_STATED' && ['measures', 'technologyConstraints'].some(field => field in patch && JSON.stringify(patch[field as keyof typeof patch]) !== JSON.stringify(old[field as 'measures' | 'technologyConstraints']))) throw new ValidationError('Changed structured facts require explicit AI_INFERRED or ASSUMED provenance and a basis. Re-analyze new customer evidence for new customer-stated facts.', ['origin', 'measures', 'technologyConstraints']);
    if (next.origin !== 'CUSTOMER_STATED' && !patch.evidence) next.evidence = old.evidence.map(a => ({ ...a, relation: 'CONTEXT' }));
    if (next.type !== old.type) { next.id = allocateId(session, next.type); next.displayId = next.id; next.supersedesId = old.id; next.revision = 0; }
    changed(next); validateScopeRecord(session, 'requirements', next);
    session.requirements[next.id] = parseCommand(RequirementSchema, next);
    if (next.id !== old.id) {
      old.lifecycle = 'RETIRED'; changed(old); session.collectionCounters.requirements++;
      // Dependencies are deliberately left visible against the retired record until edited/reviewed.
    }
    rememberEdit(session, 'Requirement', before, next, Object.keys(patch));
    return this.commit(session, expectedRevision);
  }
  async editAssumption(id: string, assumptionId: string, input: unknown) {
    const { expectedRevision, patch } = parseCommand(AssumptionEditSchema, input);
    const session = await this.snapshot(id, expectedRevision); const old = activeRecord(session.assumptions, assumptionId); const before = structuredClone(old);
    const next = { ...old, ...patch }; changed(next);
    // A changed claim cannot inherit confirmation of a different claim.
    const claimChanged = next.statement !== old.statement || JSON.stringify(next.value) !== JSON.stringify(old.value);
    if (claimChanged && next.validation === 'CONFIRMED' && patch.confirmation && JSON.stringify(patch.confirmation) === JSON.stringify(old.confirmation)) throw new ValidationError('A changed assumption requires a new confirmation note/evidence or explicit provisional/unvalidated status.', ['confirmation']);
    if (claimChanged && !patch.confirmation) { delete next.confirmation; next.validation = patch.validation ?? (old.validation === 'CONFIRMED' ? 'UNVALIDATED' : old.validation); }
    if (next.validation !== 'CONFIRMED') delete next.confirmation;
    validateScopeRecord(session, 'assumptions', next); session.assumptions[assumptionId] = parseCommand(AssumptionSchema, next);
    if (next.statement !== old.statement || next.basis !== old.basis || JSON.stringify(next.value) !== JSON.stringify(old.value)) for (const r of Object.values(session.requirements)) if (r.lifecycle === 'ACTIVE' && r.assumptionIds.includes(assumptionId)) r.review = 'DRAFT';
    rememberEdit(session, 'Assumption', before, next, Object.keys(patch)); return this.commit(session, expectedRevision);
  }
  async changeExpectedUsers(id: string, requirementId: string, input: unknown) {
    const { expectedRevision, value, basis } = parseCommand(RevisionCommandSchema.extend({ value: z.number().int().positive().max(1000000000), basis: text }), input);
    const s = await this.snapshot(id, expectedRevision); const r = activeRecord(s.requirements, requirementId);
    const measure = r.measures?.expectedUsers;
    if (measure?.state !== 'KNOWN') throw new ValidationError('Select a requirement with a recorded expected-user measure.', ['measures.expectedUsers']);
    if (measure.value.value === value) throw new ValidationError('Supply a changed expected-user target.', ['value']);
    const before = structuredClone(r); const assumptionId = allocateId(s, 'ASM');
    const evidence = r.evidence.map(a => ({ ...a, relation: 'CONTEXT' as const }));
    s.assumptions[assumptionId] = parseCommand(AssumptionSchema, { id: assumptionId, statement: `Planning target: ${value.toLocaleString('en-US')} registered users.`, basis, sources: evidence, contextRefs: [{ kind: 'Requirement', id: r.id }], validation: 'PROVISIONAL', value: { kind: 'NUMBER', value, unit: measure.value.unit }, revision: 1, lifecycle: 'ACTIVE', review: 'DRAFT', lastChangedBy: 'HUMAN' });
    s.collectionCounters.assumptions++;
    r.measures = { ...r.measures, expectedUsers: { state: 'KNOWN', value: { value, unit: measure.value.unit } } };
    r.description = `Support ${value.toLocaleString('en-US')} registered users.`; r.origin = 'ASSUMED'; r.basis = basis; r.evidence = evidence; r.assumptionIds = [...r.assumptionIds, assumptionId]; changed(r);
    validateScopeRecord(s, 'requirements', r); rememberEdit(s, 'Requirement', before, r, ['description', 'measures', 'origin', 'basis', 'evidence', 'assumptionIds']);
    return this.commit(s, expectedRevision);
  }
  async answerQuestion(id: string, questionId: string, input: unknown) {
    const { expectedRevision, answer } = parseCommand(AnswerCommandSchema, input);
    const session = await this.snapshot(id, expectedRevision); const old = activeRecord(session.questions, questionId); const before = structuredClone(old);
    const next = { ...old, answer, status: 'ANSWERED' as const }; changed(next); validateScopeRecord(session, 'questions', next);
    session.questions[questionId] = parseCommand(ClarificationQuestionSchema, next); rememberEdit(session, 'Question', before, next, ['answer', 'status']);
    return this.commit(session, expectedRevision);
  }
  async review(id: string, collection: ScopeCollection, entityId: string, input: unknown) {
    const { expectedRevision } = parseCommand(RevisionCommandSchema, input);
    const session = await this.snapshot(id, expectedRevision);
    const record = activeRecord<Requirement | Assumption | ClarificationQuestion>(session[collection], entityId); validateScopeRecord(session, collection, record);
    if ('validation' in record && record.validation === 'UNVALIDATED') throw new ValidationError('Accept the assumption as PROVISIONAL or supply confirmation before review.', ['validation']);
    record.review = 'REVIEWED'; record.reviewedRevision = record.revision; record.reviewedAt = new Date().toISOString(); record.lastChangedBy = 'HUMAN';
    session.pendingChanges = session.pendingChanges?.filter(c => !c.changes.some(change => 'id' in change.node && change.node.id === entityId));
    return this.commit(session, expectedRevision);
  }
  async approve(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(RevisionCommandSchema, input); const session = await this.snapshot(id, expectedRevision);
    const { blockers } = scopeReadiness(session);
    if (blockers.length) throw new ValidationError(blockers.join(' '), ['scope']);
    return this.commit(session, expectedRevision, true);
  }
}
