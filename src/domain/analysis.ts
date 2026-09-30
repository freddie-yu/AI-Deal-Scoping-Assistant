import { z } from 'zod';
import { ids, text, OriginSchema, PrioritySchema, RequirementTypeSchema, TypedValueSchema } from './primitives.js';
import { TechnologyConstraintSchema } from './scope.js';

export const AnalysisSubjectSchema = z.enum(['existingApplication', 'existingCRM', 'workflow', 'aiObjective', 'concurrency', 'expectedUsers', 'apiReadiness', 'rate', 'dataVolume', 'security', 'delivery']);
export const CitationSchema = z.object({ documentId: ids.SourceDocument, sectionId: ids.SourceSection, excerpt: z.string().min(1), relation: z.enum(['DIRECT', 'CONTEXT']) }).strict();
const index = z.number().int().nonnegative();
const links = z.array(index);
const measure = z.discriminatedUnion('state', [
  z.object({ state: z.literal('KNOWN'), value: z.object({ value: z.number().finite().nonnegative(), unit: text }).strict() }).strict(),
  z.object({ state: z.literal('UNRESOLVED'), reason: text, questionRefs: links.nonempty() }).strict(),
]);
export const RequirementCandidateSchema = z.object({ type: RequirementTypeSchema, description: text, priority: PrioritySchema, origin: OriginSchema, basis: text, evidence: z.array(CitationSchema).nonempty(), dependencyRefs: links, assumptionRefs: links, questionRefs: links,
  measures: z.partialRecord(z.enum(['expectedUsers', 'concurrency', 'dataVolume', 'availability', 'responseTime']), measure).optional(), technologyConstraints: z.array(TechnologyConstraintSchema).optional(),
}).strict();
export const AnalysisProposalSchema = z.object({ kind: z.literal('Analysis'), requirements: z.array(RequirementCandidateSchema).nonempty(),
  assumptions: z.array(z.object({ statement: text, basis: text, sources: z.array(CitationSchema).nonempty(), requirementRefs: links, validation: z.enum(['UNVALIDATED', 'PROVISIONAL']), value: TypedValueSchema.optional() }).strict()),
  questions: z.array(z.object({ question: text, criticality: PrioritySchema, subject: AnalysisSubjectSchema, basis: text, sources: z.array(CitationSchema).nonempty(), requirementRefs: links, assumptionRefs: links }).strict()),
  context: z.array(z.object({ topic: z.enum(['OBJECTIVES', 'PERSONAS', 'SYSTEMS', 'CONSTRAINTS', 'PREFERENCES', 'RISKS', 'MISSING_INFORMATION']), text, origin: OriginSchema, sources: z.array(CitationSchema).nonempty(), requirementRefs: links,
    facts: z.array(z.object({ subject: AnalysisSubjectSchema, value: text, requirementRefs: links.nonempty() }).strict()),
  }).strict()),
}).strict();
export type AnalysisProposal = z.infer<typeof AnalysisProposalSchema>;
