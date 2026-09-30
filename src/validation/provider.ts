import { z } from 'zod';
import type { ProviderResult } from '../ai/provider.js';
import { ValidationError } from '../application/errors.js';
export const FoundationProposalSchema = z.object({ kind: z.literal('Foundation'), message: z.string().min(1), capabilities: z.tuple([]) }).strict();
// Structural validation always precedes operation-specific source/reference hooks.
export type ProposalValidationHook<T> = (proposal: Readonly<T>) => void | Promise<void>;
export async function validateProposal<S extends z.ZodType>(result: ProviderResult, schema: S, hooks: readonly ProposalValidationHook<z.output<S>>[] = []) {
  const parsed = schema.safeParse(result.output);
  if (!parsed.success) throw new ValidationError('Provider output failed structural validation. Correct the fixture fields and retry.', parsed.error.issues.map(i => i.path.join('.')));
  for (const hook of hooks) await hook(parsed.data);
  return { proposal: parsed.data, metadata: result.metadata };
}
