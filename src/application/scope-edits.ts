import { z } from 'zod';
import { RequirementSchema, AssumptionSchema, ClarificationQuestionSchema, SourceAnchorSchema, TypedValueSchema, type ScopingSession, type Requirement, type Assumption, type ClarificationQuestion, type Stamp, type NodeRef } from '../domain/index.js';
import { validateAnchor } from '../ingestion/sources.js';
import { validateRequirementEvidence } from '../validation/analysis.js';
import { ValidationError } from './errors.js';
export const RevisionCommandSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
export const RequirementEditSchema = RevisionCommandSchema.extend({ patch: z.object(RequirementSchema.shape).strict().pick({ type: true, description: true, priority: true, origin: true, basis: true, evidence: true, inclusion: true, exclusionReason: true, dependencyIds: true, assumptionIds: true, questionIds: true, measures: true, technologyConstraints: true }).partial().refine(p => Object.keys(p).length > 0, 'Supply changed fields.') });
export const AssumptionEditSchema = RevisionCommandSchema.extend({ patch: z.object(AssumptionSchema.shape).strict().pick({ statement: true, basis: true, validation: true, value: true, confirmation: true, sources: true, contextRefs: true }).partial().refine(p => Object.keys(p).length > 0, 'Supply changed fields.') });
export const AnswerCommandSchema = RevisionCommandSchema.extend({ answer: ClarificationQuestionSchema.shape.answer.unwrap() });
export type ScopeCollection = 'requirements' | 'assumptions' | 'questions';
export function activeRecord<T extends { lifecycle: string }>(map: Record<string, T>, id: string): T {
  const record = Object.hasOwn(map, id) ? map[id] : undefined;
  if (!record || record.lifecycle !== 'ACTIVE') throw new ValidationError('Select an existing active scope item.', ['id']);
  return record;
}
export function changed(record: Stamp) { record.revision++; record.review = 'DRAFT'; record.lastChangedBy = 'HUMAN'; }
export function rememberEdit(s: ScopingSession, kind: 'Requirement' | 'Assumption' | 'Question', before: Requirement | Assumption | ClarificationQuestion, after: typeof before, fields: string[]) {
  // One before-edit snapshot per pending record, bounded by current scope size.
  const pending = s.pendingChanges ??= [];
  const existing = pending.find(c => c.changes.some(change => change.node.kind === kind && 'id' in change.node && change.node.id === before.id));
  if (existing) { existing.currentSessionRevision = s.revision + 1; existing.changes[0]!.after = [{ kind: 'TEXT', value: JSON.stringify(after) }]; existing.changes[0]!.fields = [...new Set([...existing.changes[0]!.fields, ...fields])]; return; }
  pending.push({ id: `edit-${kind}-${before.id}`, baseSessionRevision: s.revision, currentSessionRevision: s.revision + 1, changes: [{ node: { kind, id: before.id }, fields, before: [{ kind: 'TEXT', value: JSON.stringify(before) }], after: [{ kind: 'TEXT', value: JSON.stringify(after) }] }], membershipChanges: [] });
}
export function validateScopeRefs(s: ScopingSession, refs: NodeRef[], path: string) {
  for (const ref of refs) {
    const map = ref.kind === 'Requirement' ? s.requirements : ref.kind === 'Assumption' ? s.assumptions : ref.kind === 'Question' ? s.questions : ref.kind === 'SourceDocument' ? s.documents : ref.kind === 'SourceSection' ? s.sourceSections : undefined;
    if (!map || !('id' in ref) || !Object.hasOwn(map, ref.id)) throw new ValidationError('Reference must identify an existing scope or source record.', [path]);
  }
}
export function validateScopeRecord(s: ScopingSession, kind: ScopeCollection, record: Requirement | Assumption | ClarificationQuestion) {
  if (kind === 'requirements') {
    const r = record as Requirement; validateRequirementEvidence(s, r);
    for (const [field, map] of [['dependencyIds', s.requirements], ['assumptionIds', s.assumptions], ['questionIds', s.questions]] as const) {
      if (r[field].some(id => !Object.hasOwn(map, id)) || new Set(r[field]).size !== r[field].length) throw new ValidationError('Links must identify existing unique scope records.', [field]);
    }
    if (r.dependencyIds.includes(r.id)) throw new ValidationError('A requirement cannot depend on itself.', ['dependencyIds']);
    if (r.origin === 'ASSUMED' && !r.assumptionIds.length) throw new ValidationError('Assumed requirements must link an explicit assumption.', ['assumptionIds']);
    for (const measure of Object.values(r.measures ?? {})) if (measure?.state === 'UNRESOLVED' && measure.questionIds.some(id => !r.questionIds.includes(id))) throw new ValidationError('Missing measures must link their clarification questions.', ['measures']);
  } else if (kind === 'assumptions') {
    const a = record as Assumption; a.sources.forEach(anchor => validateAnchor(s, anchor)); a.confirmation?.evidence.forEach(anchor => validateAnchor(s, anchor)); validateScopeRefs(s, a.contextRefs, 'contextRefs');
    if (!a.sources.length && !a.contextRefs.length) throw new ValidationError('An assumption needs source or context references.', ['sources']);
  } else {
    const q = record as ClarificationQuestion; q.sources?.forEach(anchor => validateAnchor(s, anchor)); q.answer?.evidence.forEach(anchor => validateAnchor(s, anchor)); validateScopeRefs(s, q.related, 'related');
  }
}
