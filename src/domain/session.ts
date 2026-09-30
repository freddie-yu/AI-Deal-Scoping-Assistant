import { z } from 'zod';
import { ids, text, revision, counter, Collections, InputRefSchema, NodeRefSchema, FieldPathSchema } from './primitives.js';
import { SourceDocumentSchema, SourceSectionSchema, RequirementSchema, AssumptionSchema, ClarificationQuestionSchema } from './scope.js';
import { ArtifactSchema, ArtifactSectionSchema } from './artifacts.js';
import { ConfigurationSchema } from './configuration.js';
import { ChangeSetSchema, ImpactResultSchema, QualityGateSchema, ExportReceiptSchema } from './operations.js';
export const OperationSchema = z.enum(['analyze', 'prd-scope', 'architecture', 'strategies', 'delivery', 'estimate', 'impact-explanation']);
export const ValidatedRecordSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Requirement'), record: RequirementSchema }).strict(),
  z.object({ kind: z.literal('Assumption'), record: AssumptionSchema }).strict(),
  z.object({ kind: z.literal('Question'), record: ClarificationQuestionSchema }).strict(),
  z.object({ kind: z.literal('ArtifactSection'), record: ArtifactSectionSchema }).strict(),
]);
export const GenerationRunSchema = z.object({
  id: ids.GenerationRun, operation: OperationSchema, mode: z.enum(['LIVE', 'MOCK', 'DETERMINISTIC']), schemaVersion: text, baseSessionRevision: revision,
  scopeFingerprint: text.optional(), acceptanceRevision: revision.optional(), decisions: z.record(ids.ArtifactSection, z.enum(['ACCEPTED', 'REJECTED'])).optional(), inputs: z.array(InputRefSchema), allowedTargets: z.array(NodeRefSchema), createWithin: z.array(NodeRefSchema), state: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED']), acceptance: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']),
  proposals: z.array(z.discriminatedUnion('action', [
    z.object({ action: z.literal('CREATE'), target: NodeRefSchema, candidate: ValidatedRecordSchema }).strict(),
    z.object({ action: z.literal('UPDATE'), target: NodeRefSchema, expectedRevision: revision, candidate: ValidatedRecordSchema }).strict(),
    z.object({ action: z.literal('RETIRE'), target: NodeRefSchema, expectedRevision: revision }).strict(),
  ])), provider: text.optional(), model: text.optional(), fixtureVariant: text.optional(), error: z.object({ code: text, message: text, paths: z.array(z.string()) }).strict().optional(),
}).strict();
export const ContextSchema = z.object({ customerName: text, opportunityName: text, analysisSectionIds: z.array(ids.ArtifactSection) }).strict();
const keyed = <T extends z.ZodType>(schema: T) => z.record(text, schema);
export const ScopingSessionSchema = z.object({
  id: ids.ScopingSession, schemaVersion: z.literal('1'), revision, operationalRevision: counter.default(0),
  context: ContextSchema, providerMode: z.literal('MOCK'), seedId: text.optional(),
  idCounters: z.record(z.enum(['DOC', 'SRC', 'BR', 'FR', 'NFR', 'INT', 'DATA', 'SEC', 'ASM', 'Q', 'ART', 'AS', 'RUN']), counter),
  activeSourceIds: z.array(ids.SourceDocument), collectionCounters: z.record(Collections, counter),
  documents: keyed(SourceDocumentSchema), sourceSections: keyed(SourceSectionSchema), requirements: keyed(RequirementSchema), assumptions: keyed(AssumptionSchema), questions: keyed(ClarificationQuestionSchema), artifacts: keyed(ArtifactSchema), artifactSections: keyed(ArtifactSectionSchema), generationRuns: keyed(GenerationRunSchema), configuration: ConfigurationSchema,
  scopeReviewFingerprint: text.nullable(),
  pendingChanges: z.array(ChangeSetSchema).optional(), lastImpact: ImpactResultSchema.optional(), gate: QualityGateSchema.optional(), exportReceipt: ExportReceiptSchema.optional(),
}).strict().superRefine((v, ctx) => {
  for (const name of Collections.options) {
    for (const [key, record] of Object.entries(v[name])) {
      if (key !== record.id) ctx.addIssue({ code: 'custom', path: [name, key], message: 'Map key must equal record ID' });
      if ('review' in record && record.review === 'REVIEWED' && (!record.reviewedAt || record.reviewedRevision !== record.revision)) ctx.addIssue({ code: 'custom', path: [name, key, 'reviewedRevision'], message: 'Review must identify the current content revision and timestamp' });
    }
  }
  for (const id of v.activeSourceIds) if (!v.documents[id]) ctx.addIssue({ code: 'custom', path: ['activeSourceIds'], message: 'Active document does not exist' });
  const identities = new Set<string>(); const estimates = new Set<string>();
  for (const section of Object.values(v.artifactSections)) {
    const p = section.payload;
    if (p.kind === 'EstimationUnit') {
      const s = p.source;
      const identity = `${p.unitType}:${s.kind}:${s.kind === 'DOMAIN' ? s.sectionId : s.kind === 'SOLUTION' ? s.sessionId : s.kind === 'TEST_TARGET' ? s.unitId : s.key}`;
      if (identities.has(identity)) ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id], message: 'Duplicate canonical unit identity (workstream does not define identity)' });
      identities.add(identity);
      if (v.artifactSections[p.workstreamId]?.payload.kind !== 'Workstream') ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id, 'payload', 'workstreamId'], message: 'Unit owner must be a Workstream' });
      const expected = p.unitType === 'APPLICATION' ? 'Capability' : p.unitType === 'INTEGRATION' ? 'Integration' : p.unitType === 'AI' ? 'AIUseCase' : null;
      if (s.kind === 'DOMAIN' && v.artifactSections[s.sectionId]?.payload.kind !== expected) ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id, 'payload', 'source'], message: 'Unit source must reference the corresponding domain variant' });
      if ((s.kind === 'ENVIRONMENT' || s.kind === 'MIGRATION_PACKAGE') && s.scopeRefs.some(id => v.artifactSections[id]?.payload.kind !== (s.kind === 'ENVIRONMENT' ? 'ArchitectureComponent' : 'DataDomain'))) ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id, 'payload', 'source'], message: 'Boundary has incompatible scope references' });
      if (s.kind === 'TEST_TARGET') { const target = v.artifactSections[s.unitId]?.payload; if (target?.kind !== 'EstimationUnit' || !['APPLICATION', 'INTEGRATION', 'DATA', 'AI'].includes(target.unitType)) ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id, 'payload', 'source'], message: 'Testing target must be a primary implementation unit' }); }
      if (s.kind === 'SOLUTION' && s.sessionId !== v.id) ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id, 'payload', 'source'], message: 'Solution source must be this session' });
    }
    if (p.kind === 'EstimateItem' && section.lifecycle === 'ACTIVE' && section.freshness === 'CURRENT') {
      if (estimates.has(p.unitId) || v.artifactSections[p.unitId]?.payload.kind !== 'EstimationUnit') ctx.addIssue({ code: 'custom', path: ['artifactSections', section.id], message: 'Estimate must uniquely reference a canonical unit' });
      estimates.add(p.unitId);
    }
  }
});
export type ScopingSession = z.infer<typeof ScopingSessionSchema>;
export type GenerationRun = z.infer<typeof GenerationRunSchema>;
export type Operation = z.infer<typeof OperationSchema>;
