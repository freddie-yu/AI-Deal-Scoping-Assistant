import { Phase2ExpectationsSchema } from './phase2-expectations.js';
import { z } from 'zod';
import { ContextSchema, ConfigurationSchema, AssumptionSchema, SourceDocumentSchema, SourceSectionSchema, ValidatedRecordSchema, OperationSchema, OriginSchema, text, FieldPathSchema } from '../domain/index.js';
export const SeedIdSchema = z.enum(['modernization', 'integration-heavy', 'ai-enabled', 'missing-information']);
const expectation = z.object({ selector: FieldPathSchema, description: text, expectedValue: z.union([text, z.number().finite(), z.boolean()]).optional(), origin: OriginSchema.optional(), relatedAliases: z.array(text) }).strict();
const goldens = z.object({ mustExtract: z.array(expectation), mustClassify: z.array(expectation), mustIdentifyMissing: z.array(expectation), mustNotInvent: z.array(expectation), expectedCapabilities: z.array(expectation), expectedRecommendationConstraints: z.array(expectation), emptyReasons: z.record(text, text) }).strict();
export const SeedManifestSchema = z.object({ id: SeedIdSchema, version: z.literal('1'), phase: z.enum(['FOUNDATION', 'SCOPE']), title: text, description: text, context: ContextSchema,
  input: z.object({ title: text, text: z.string().min(1), inputKind: z.enum(['PASTED_TEXT', 'PASTED_MARKDOWN']) }).strict().optional(),
  sourceRequirements: z.object({ fingerprint: text, documents: z.array(SourceDocumentSchema), sections: z.array(SourceSectionSchema) }).strict().optional(),
  assumptions: z.array(AssumptionSchema).optional(), configuration: ConfigurationSchema.optional(),
  phase2Expectations: Phase2ExpectationsSchema.optional(),
  mockResponses: z.array(z.object({ operation: OperationSchema, variant: text, fixture: text }).strict()),
  expectedStructuredOutputs: z.array(ValidatedRecordSchema).optional(), semanticGoldenExpectations: goldens.optional(),
  changeVariants: z.array(z.object({ id: text, description: text, expectations: goldens }).strict()).optional(),
  expectedCoverageQuality: z.object({ status: z.enum(['PASS', 'REVIEW_REQUIRED', 'BLOCKED']), coveredAliases: z.array(text), uncoveredAliases: z.array(text), issueTypes: z.array(text) }).strict().optional(),
}).strict();
