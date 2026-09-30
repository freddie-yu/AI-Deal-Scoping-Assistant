import { z } from 'zod';
import { text, ids, counter, revision, OriginSchema, PrioritySchema, InclusionSchema, GroundingSchema, SourceAnchorSchema, NodeRefSchema, StampSchema, InputRefSchema, FreshnessSchema, knowledge } from './primitives.js';
import { AnalysisSubjectSchema } from './analysis.js';
import { TechnologyChoiceSchema } from './scope.js';
import { EstimationUnitPayloadSchema, EstimateItemPayloadSchema, EstimateSummaryPayloadSchema } from './estimation.js';
export const ArtifactKindSchema = z.enum(['ANALYSIS', 'PRD', 'FUNCTIONAL_SCOPE', 'ARCHITECTURE', 'DATA_STRATEGY', 'INTEGRATION_STRATEGY', 'AI_STRATEGY', 'DELIVERY_PLAN', 'ESTIMATE', 'FINAL_PACKAGE']);
export const ArtifactSchema = z.object({ id: ids.Artifact, revision, kind: ArtifactKindSchema, title: text, sectionIds: z.array(ids.ArtifactSection), templateVersion: text }).strict();
export const TopicSchema = z.enum(['EXECUTIVE_SUMMARY', 'OVERVIEW', 'PROBLEM', 'OBJECTIVES', 'PERSONAS', 'JOURNEYS', 'FUNCTIONAL_REQUIREMENTS', 'NON_FUNCTIONAL_REQUIREMENTS', 'SYSTEMS', 'CONSTRAINTS', 'PREFERENCES', 'INTEGRATIONS', 'DATA', 'SECURITY', 'DEPENDENCIES', 'ASSUMPTIONS', 'RISKS', 'EXCLUSIONS', 'QUESTIONS', 'MISSING_INFORMATION', 'TRACEABILITY', 'COVERAGE', 'ARCHITECTURE', 'DEPLOYMENT', 'ENVIRONMENTS', 'AVAILABILITY', 'SCALABILITY', 'OBSERVABILITY', 'RECOVERY', 'TECHNOLOGIES', 'DELIVERY', 'ESTIMATION', 'QUALITY']);
const policy = knowledge(text);
const endpoint = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('COMPONENT'), sectionId: ids.ArtifactSection }).strict(),
  z.object({ kind: z.literal('EXTERNAL_SYSTEM'), name: text, description: text, sources: z.array(SourceAnchorSchema), requirementIds: z.array(ids.Requirement) }).strict(),
]);
const flow = z.object({ from: endpoint, to: endpoint, description: text }).strict();
export const NarrativePayloadSchema = z.object({ kind: z.literal('Narrative'), topic: TopicSchema, facts: z.array(z.object({ subject: AnalysisSubjectSchema, value: text, requirementIds: z.array(ids.Requirement).nonempty() }).strict()).optional(), paragraphs: z.array(z.object({ text, origin: OriginSchema, anchors: z.array(SourceAnchorSchema), grounding: z.array(GroundingSchema) }).strict()), referencedIds: z.array(NodeRefSchema), affectedRefs: z.array(NodeRefSchema) }).strict();
export const SectionPayloadSchema = z.discriminatedUnion('kind', [
  NarrativePayloadSchema,
  z.object({ kind: z.literal('Capability'), description: text, priority: PrioritySchema, inclusion: InclusionSchema, classification: z.enum(['REQUESTED', 'INTERPRETED', 'ENHANCEMENT', 'ASSUMPTION_DEPENDENT', 'OUT_OF_SCOPE']), requirementIds: z.array(ids.Requirement).nonempty(), module: text.optional(), package: text.optional(), exclusionReason: text.optional() }).strict(),
  z.object({ kind: z.literal('ArchitectureComponent'), name: text, cloud: z.literal('AWS'), catalogServiceKey: text, purpose: text, rationale: text, tradeOffs: policy, securityControls: policy, connections: z.array(flow) }).strict(),
  z.object({ kind: z.literal('DataDomain'), name: text, sources: z.array(endpoint), ownership: policy, ingestion: policy, storageRefs: z.array(ids.ArtifactSection), quality: policy, governance: policy, metadata: policy, retention: policy, privacy: policy, security: policy, analytics: policy, recovery: policy, flows: z.array(flow) }).strict(),
  z.object({ kind: z.literal('Integration'), name: text, endpoints: z.array(endpoint).min(2), pattern: z.enum(['API', 'EVENT', 'BATCH', 'FILE']), dataDomainRefs: z.array(ids.ArtifactSection), authentication: policy, errors: policy, retry: policy, monitoring: policy, synchronization: policy }).strict(),
  z.object({ kind: z.literal('AIUseCase'), purpose: text, aiRequirementIds: z.array(ids.Requirement).nonempty(), deterministicAlternative: policy, humanDecisions: policy, pattern: policy, modelOptions: policy, frameworkRationale: policy, retrieval: policy, orchestration: policy, prompts: policy, outputManagement: policy, evaluation: policy, safety: policy, privacy: policy, monitoring: policy, feedback: policy, humanReviewControls: policy }).strict(),
  // Membership, scope refs and roles are derived from unit ownership, never an editable member list.
  z.object({ kind: z.literal('Workstream'), name: text, phaseKey: text, phaseOrder: counter, predecessorRefs: z.array(ids.ArtifactSection), milestones: z.array(z.object({ key: text, label: text }).strict()), risks: z.array(text), exclusions: z.array(text), waitInput: InputRefSchema.optional(), displayGroups: z.array(text).optional(), advisory: z.object({ scopeRefs: z.array(ids.ArtifactSection), suggestedRoles: z.array(text).nonempty(), complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']), drivers: z.array(text).nonempty() }).strict().optional() }).strict(),
  EstimationUnitPayloadSchema, EstimateItemPayloadSchema, EstimateSummaryPayloadSchema,
  z.object({ kind: z.literal('Composite'), sectionIds: z.array(ids.ArtifactSection), renderingVersion: text, templateVersion: text, exportReceiptId: text.optional() }).strict(),
]);
export const ArtifactSectionSchema = StampSchema.extend({ review: z.enum(['PROPOSED', 'REVIEWED']), id: ids.ArtifactSection, artifactId: ids.Artifact, sectionKey: text, title: text, origin: OriginSchema, payload: SectionPayloadSchema, grounding: z.array(GroundingSchema), inputs: z.array(InputRefSchema), freshness: FreshnessSchema, staleCauses: z.array(NodeRefSchema), technologyChoices: z.array(TechnologyChoiceSchema).optional(), dependencies: z.array(ids.ArtifactSection).optional(), applicability: policy.optional() });
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ArtifactSection = z.infer<typeof ArtifactSectionSchema>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
