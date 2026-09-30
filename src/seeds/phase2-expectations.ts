import { z } from 'zod';
import { text } from '../domain/primitives.js';
export const Phase2ExpectationsSchema = z.object({
  mustHaveCapabilities: z.array(text), mustCoverRequirements: z.array(text), mustNotAddUnsupportedCapability: z.literal(true),
  expectedArchitecture: z.array(text), forbiddenArchitecture: z.array(text),
  expectedIntegrations: z.array(z.object({ name: text, sourceText: text }).strict()),
  expectedAIUseCases: z.array(z.object({ sourceText: text, humanApproval: z.boolean() }).strict()), forbiddenAIUseCases: z.array(text),
  expectedRecommendationConstraints: z.array(z.enum(['POSTGRESQL_COMPATIBLE', 'HUMAN_APPROVAL', 'NO_INVENTED_SCALE', 'NO_UNGROUNDED_RECOMMENDATIONS'])),
}).strict();
