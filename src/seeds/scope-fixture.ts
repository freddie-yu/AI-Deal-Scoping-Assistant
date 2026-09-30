import { z } from 'zod';
import { AnalysisProposalSchema, CitationSchema } from '../domain/analysis.js';

const fixtureCitation = CitationSchema.omit({ documentId: true, sectionId: true }).extend({ sectionOrdinal: z.number().int().nonnegative() });
// Recorded fixture citations are bound to the captured source version by MockAIProvider.
export const ScopeFixtureSchema = z.object({ fingerprint: z.string().min(1), analysis: AnalysisProposalSchema.extend({
  requirements: z.array(AnalysisProposalSchema.shape.requirements.element.extend({ evidence: z.array(fixtureCitation).nonempty() })).nonempty(),
  assumptions: z.array(AnalysisProposalSchema.shape.assumptions.element.extend({ sources: z.array(fixtureCitation).nonempty() })),
  questions: z.array(AnalysisProposalSchema.shape.questions.element.extend({ sources: z.array(fixtureCitation).nonempty() })),
  context: z.array(AnalysisProposalSchema.shape.context.element.extend({ sources: z.array(fixtureCitation).nonempty() })),
}) }).strict();
