import { z } from 'zod';
import { text, counter, revision, ids, NodeRefSchema, FieldPathSchema, InputRefSchema, GroundingSchema, TypedValueSchema } from './primitives.js';
export const DependencyEdgeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SUPPORTS'), upstream: GroundingSchema.shape.source, downstream: z.object({ kind: z.literal('ArtifactSection'), id: ids.ArtifactSection }).strict(), basis: GroundingSchema }).strict(),
  z.object({ kind: z.literal('DEPENDS_ON'), upstream: NodeRefSchema, downstream: NodeRefSchema, fields: z.array(FieldPathSchema), consumedRevision: counter, valueHash: text }).strict(),
]);
export const ChangeSetSchema = z.object({ id: text, baseSessionRevision: revision, currentSessionRevision: revision,
  changes: z.array(z.object({ node: NodeRefSchema, fields: z.array(FieldPathSchema), before: z.array(TypedValueSchema), after: z.array(TypedValueSchema), oldRevision: counter.optional(), newRevision: counter.optional(), fieldChanges: z.array(z.object({ field: FieldPathSchema, before: TypedValueSchema, after: TypedValueSchema }).strict()).optional() }).strict()),
  membershipChanges: z.array(z.object({ collection: NodeRefSchema, added: z.array(NodeRefSchema), removed: z.array(NodeRefSchema) }).strict()),
}).strict();
export const ImpactResultSchema = z.object({
  changeId: text, evaluatedRevision: revision, change: ChangeSetSchema.optional(), direct: z.array(NodeRefSchema), transitive: z.array(NodeRefSchema),
  reasons: z.array(z.object({ node: NodeRefSchema, path: z.array(NodeRefSchema), reason: text, fields: z.array(FieldPathSchema).optional(), edgeId: text.optional(), direct: z.boolean().optional(), potential: z.boolean().optional() }).strict()),
  affectedSectionIds: z.array(ids.ArtifactSection), affectedEstimateIds: z.array(ids.ArtifactSection), unaffectedReviewed: z.array(z.object({ id: ids.ArtifactSection, hash: text }).strict()),
  unknown: z.array(NodeRefSchema).default([]), staleTargets: z.array(NodeRefSchema).default([]), recalculationTargets: z.array(NodeRefSchema).default([]), regenerationTargets: z.array(NodeRefSchema).default([]),
  refreshTargets: z.array(z.enum(['COVERAGE', 'QUALITY', 'DIAGRAM'])).default([]),
  affectedSlices: z.array(z.object({ id: ids.ArtifactSection, affected: z.array(text), unaffected: z.array(text) }).strict()).default([]),
  diagnostics: z.array(z.object({ node: NodeRefSchema, reason: text }).strict()).default([]),
}).strict();
export const CompatibilityResultSchema = z.object({ constraint: InputRefSchema, choice: InputRefSchema.nullable(), status: z.enum(['COMPATIBLE', 'CONFLICT', 'UNKNOWN']), ruleIds: z.array(text), catalog: InputRefSchema, reason: text }).strict();
export const ValidationIssueSchema = z.object({ key: text, ruleId: text, ruleVersion: text, type: z.enum(['UNCOVERED_REQUIREMENT', 'UNSUPPORTED_SCOPE', 'UNJUSTIFIED_COMPONENT', 'MISSING_WORKSTREAM', 'INCOMPLETE_AI_CONTROLS', 'MISSING_ESTIMATE_INPUT', 'UNRESOLVED_QUESTION', 'TECHNOLOGY_CONFLICT', 'TECHNOLOGY_UNKNOWN', 'COMMERCIAL_INCONSISTENCY', 'UNVALIDATED_ASSUMPTION', 'ESTIMATION_LIMITATION', 'STRUCTURAL_INTEGRITY']), severity: z.enum(['WARNING', 'ERROR']), status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']), related: z.array(NodeRefSchema), paths: z.array(FieldPathSchema), message: text, blocking: z.boolean(), evaluatedRevision: revision, resolution: z.object({ note: text, revision, evidenceRefs: z.array(NodeRefSchema) }).strict().optional() }).strict();
const stage = z.object({ coveredIds: z.array(ids.Requirement), uncoveredIds: z.array(ids.Requirement) }).strict();
export const CoverageSchema = z.object({ evaluatedRevision: revision, eligibleRequirementIds: z.array(ids.Requirement), scope: stage, design: stage, delivery: stage, excluded: z.array(z.object({ id: ids.Requirement, reason: text }).strict()), highPriority: z.object({ eligible: counter, covered: counter }).strict() }).strict();
export const QualityGateSchema = z.object({ id: z.string().regex(/^GATE_\d{2,}$/), evaluatedRevision: revision, ruleVersion: text, issues: z.array(ValidationIssueSchema), coverage: CoverageSchema, compatibilityResults: z.array(CompatibilityResultSchema), status: z.enum(['PASS', 'REVIEW_REQUIRED', 'BLOCKED']), acknowledgment: z.object({ revision, findingsHash: text, timestamp: z.iso.datetime() }).strict().optional() }).strict();
export const ExportReceiptSchema = z.object({ id: text, revision, templateVersion: text, disclaimerVersion: text, gateId: text, findingsHash: text, timestamp: z.iso.datetime(), fileHash: text }).strict();
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type ImpactResult = z.infer<typeof ImpactResultSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
