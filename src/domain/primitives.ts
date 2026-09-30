import { z } from 'zod';
import { isRegisteredFieldPath } from './field-paths.js';
export const text = z.string().trim().min(1);
export const revision = z.number().int().positive();
export const counter = z.number().int().nonnegative();
export const SessionIdSchema = z.uuid().refine(value => value === value.toLowerCase(), 'Session IDs use canonical lowercase UUIDs');
export const ids = {
  ScopingSession: SessionIdSchema, SourceDocument: z.string().regex(/^DOC_\d{2,}$/),
  SourceSection: z.string().regex(/^SRC_\d{2,}$/), Requirement: z.string().regex(/^(BR|FR|NFR|INT|DATA|SEC)_\d{2,}$/),
  Assumption: z.string().regex(/^ASM_\d{2,}$/), Question: z.string().regex(/^Q_\d{2,}$/),
  Artifact: z.string().regex(/^ART_\d{2,}$/), ArtifactSection: z.string().regex(/^AS_\d{2,}$/),
  Configuration: z.literal('CFG_01'), GenerationRun: z.string().regex(/^RUN_\d{2,}$/),
};
export type EntityKind = keyof typeof ids;
export type Id<K extends EntityKind> = string & { readonly __kind: K };
export const OriginSchema = z.enum(['CUSTOMER_STATED', 'AI_INFERRED', 'ASSUMED']);
export const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const InclusionSchema = z.enum(['INCLUDED', 'EXCLUDED']);
export const FreshnessSchema = z.enum(['CURRENT', 'STALE']);
export const RequirementTypeSchema = z.enum(['BR', 'FR', 'NFR', 'INT', 'DATA', 'SEC']);
export const Collections = z.enum(['documents', 'sourceSections', 'requirements', 'assumptions', 'questions', 'artifacts', 'artifactSections', 'generationRuns']);
export const ResourceSchema = z.object({ kind: z.enum(['RULESET', 'AWS_CATALOG', 'TECH_COMPATIBILITY', 'DOCUMENT_TEMPLATE']), id: text, version: text, hash: text }).strict();
export const EntityRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ScopingSession'), id: ids.ScopingSession }).strict(),
  z.object({ kind: z.literal('SourceDocument'), id: ids.SourceDocument }).strict(),
  z.object({ kind: z.literal('SourceSection'), id: ids.SourceSection }).strict(),
  z.object({ kind: z.literal('Requirement'), id: ids.Requirement }).strict(),
  z.object({ kind: z.literal('Assumption'), id: ids.Assumption }).strict(),
  z.object({ kind: z.literal('Question'), id: ids.Question }).strict(),
  z.object({ kind: z.literal('Artifact'), id: ids.Artifact }).strict(),
  z.object({ kind: z.literal('ArtifactSection'), id: ids.ArtifactSection }).strict(),
  z.object({ kind: z.literal('GenerationRun'), id: ids.GenerationRun }).strict(),
]);
// Registered substantive roots; review bookkeeping is deliberately not a freshness input.
export const FieldPathSchema = text.refine(isRegisteredFieldPath, 'Unregistered substantive field path');
export const NodeRefSchema = z.union([EntityRefSchema,
  z.object({ kind: z.literal('CONFIGURATION'), id: ids.Configuration, key: text }).strict(),
  z.object({ kind: z.literal('COLLECTION'), name: Collections }).strict(), ResourceSchema,
]);
export const InputRefSchema = z.object({ node: NodeRefSchema, fields: z.array(FieldPathSchema).nonempty(), consumedRevision: counter, valueHash: text }).strict();
export const GroundingSchema = z.object({ source: z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Requirement'), id: ids.Requirement }).strict(),
  z.object({ kind: z.literal('Assumption'), id: ids.Assumption }).strict(),
]), reviewedRevision: revision, rationale: text }).strict();
export const knowledge = <T extends z.ZodType>(value: T) => z.discriminatedUnion('state', [
  z.object({ state: z.literal('KNOWN'), value }).strict(),
  z.object({ state: z.literal('UNRESOLVED'), reason: text, questionIds: z.array(ids.Question) }).strict(),
  z.object({ state: z.literal('NOT_APPLICABLE'), reason: text }).strict(),
]);
export const computationalKnowledge = <T extends z.ZodType>(value: T) => z.discriminatedUnion('state', [
  z.object({ state: z.literal('KNOWN'), value }).strict(),
  z.object({ state: z.literal('UNRESOLVED'), reason: text, questionIds: z.array(ids.Question) }).strict(),
]);
export const TypedValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NUMBER'), value: z.number().finite(), unit: text }).strict(),
  z.object({ kind: z.literal('TEXT'), value: text }).strict(),
  z.object({ kind: z.literal('BOOLEAN'), value: z.boolean() }).strict(),
]);
export const StampSchema = z.object({ revision, lifecycle: z.enum(['ACTIVE', 'RETIRED']), review: z.enum(['DRAFT', 'PROPOSED', 'REVIEWED']), reviewedRevision: revision.optional(), reviewedAt: z.iso.datetime().optional(), lastChangedBy: z.enum(['HUMAN', 'AI', 'MOCK', 'ENGINE']), generationRunId: ids.GenerationRun.optional() }).strict();
export const SourceAnchorSchema = z.object({ documentId: ids.SourceDocument, sectionId: ids.SourceSection, start: counter, end: counter, excerpt: z.string().min(1), relation: z.enum(['DIRECT', 'CONTEXT']) }).strict().refine(v => v.end > v.start, 'Anchor end must follow start');
export const RangeSchema = z.object({ low: z.number().finite().nonnegative(), high: z.number().finite().nonnegative(), unit: text }).strict().refine(v => v.low <= v.high, 'Range must be ordered');
export const ConfidenceSchema = PrioritySchema;
export type Origin = z.infer<typeof OriginSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Inclusion = z.infer<typeof InclusionSchema>;
export type Freshness = z.infer<typeof FreshnessSchema>;
export type Knowledge<T> = { state: 'KNOWN'; value: T } | { state: 'UNRESOLVED'; reason: string; questionIds: string[] } | { state: 'NOT_APPLICABLE'; reason: string };
export type Stamp = z.infer<typeof StampSchema>;
export type NodeRef = z.infer<typeof NodeRefSchema>;
export type InputRef = z.infer<typeof InputRefSchema>;
export type Grounding = z.infer<typeof GroundingSchema>;
export type SourceAnchor = z.infer<typeof SourceAnchorSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type RequirementType = z.infer<typeof RequirementTypeSchema>;
export type FieldPath = z.infer<typeof FieldPathSchema>;
export type Ref<K extends EntityKind> = { [P in K]: { kind: P; id: Id<P> } }[K];
