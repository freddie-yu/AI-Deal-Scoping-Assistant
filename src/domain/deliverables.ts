import { z } from 'zod';
import { SectionPayloadSchema } from './artifacts.js';
import { ids, text, knowledge, OriginSchema } from './primitives.js';
import { TechnologyChoiceSchema } from './scope.js';

export const Phase2OperationSchema = z.enum(['prd-scope', 'architecture', 'strategies', 'delivery']);
export type Phase2Operation = z.infer<typeof Phase2OperationSchema>;
export const PRD_TOPICS = ['OVERVIEW', 'PROBLEM', 'OBJECTIVES', 'PERSONAS', 'JOURNEYS', 'FUNCTIONAL_REQUIREMENTS', 'NON_FUNCTIONAL_REQUIREMENTS', 'INTEGRATIONS', 'DEPENDENCIES', 'ASSUMPTIONS', 'RISKS', 'EXCLUSIONS', 'QUESTIONS', 'TRACEABILITY'] as const;
// Temporary keys are scoped to this response; only application code allocates AS IDs.
const ref = z.union([ids.ArtifactSection, z.string().regex(/^local:[a-z][a-z0-9-]*$/)]);
const key = z.string().regex(/^[a-z][a-z0-9-]*$/);
const [narrative, capability, component, data, integration, ai, workstream] = SectionPayloadSchema.options;
const canonicalEndpoint = component.shape.connections.element.shape.from;
const endpoint = z.discriminatedUnion('kind', [canonicalEndpoint.options[0].extend({ sectionId: ref }), canonicalEndpoint.options[1]]);
const flow = component.shape.connections.element.extend({ from: endpoint, to: endpoint });
const narrativeRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Requirement'), id: ids.Requirement }).strict(),
  z.object({ kind: z.literal('Assumption'), id: ids.Assumption }).strict(),
  z.object({ kind: z.literal('Question'), id: ids.Question }).strict(),
  z.object({ kind: z.literal('ArtifactSection'), id: ids.ArtifactSection }).strict(),
]);
const narrativeCandidate = narrative.extend({ paragraphs: z.array(z.object({ text, origin: OriginSchema }).strict()).nonempty(), referencedIds: z.array(narrativeRef), affectedRefs: z.array(narrativeRef) });
const componentCandidate = component.extend({ connections: z.array(flow) });
const dataCandidate = data.extend({ sources: z.array(endpoint), storageRefs: z.array(ref), flows: z.array(flow) });
const integrationCandidate = integration.extend({ endpoints: z.array(endpoint).min(2), dataDomainRefs: z.array(ref) });
const workstreamCandidate = workstream.omit({ waitInput: true }).extend({ predecessorRefs: z.array(ref), advisory: z.object({ scopeRefs: z.array(ref).nonempty(), suggestedRoles: z.array(text).nonempty(), complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']), drivers: z.array(text).nonempty() }).strict() });
const common = { key, title: text, origin: z.literal('AI_INFERRED'), requirementIds: z.array(ids.Requirement), assumptionIds: z.array(ids.Assumption), rationale: text, dependencies: z.array(ref), applicability: knowledge(text), technologyChoices: z.array(TechnologyChoiceSchema) };
const candidate = <P extends z.ZodType, K extends string>(kind: K, payload: P) => z.object({ ...common, artifactKind: z.literal(kind), payload }).strict();
export const PRDSectionCandidateSchema = candidate('PRD', narrativeCandidate);
export const CapabilityCandidateSchema = candidate('FUNCTIONAL_SCOPE', capability);
export const ArchitectureCandidateSchema = candidate('ARCHITECTURE', z.union([componentCandidate, narrativeCandidate]));
export const DataCandidateSchema = candidate('DATA_STRATEGY', z.union([dataCandidate, narrativeCandidate]));
export const IntegrationCandidateSchema = candidate('INTEGRATION_STRATEGY', z.union([integrationCandidate, narrativeCandidate]));
export const AICandidateSchema = candidate('AI_STRATEGY', z.union([ai, narrativeCandidate]));
export const DeliveryCandidateSchema = candidate('DELIVERY_PLAN', workstreamCandidate);
export const phase2Schemas = {
  'prd-scope': z.object({ sections: z.array(z.union([PRDSectionCandidateSchema, CapabilityCandidateSchema])).nonempty() }).strict(),
  architecture: z.object({ sections: z.array(ArchitectureCandidateSchema).nonempty() }).strict(),
  strategies: z.object({ sections: z.array(z.union([DataCandidateSchema, IntegrationCandidateSchema, AICandidateSchema])).nonempty() }).strict(),
  delivery: z.object({ sections: z.array(DeliveryCandidateSchema).nonempty() }).strict(),
};
export type SectionCandidate = z.infer<typeof phase2Schemas[Phase2Operation]>['sections'][number];
