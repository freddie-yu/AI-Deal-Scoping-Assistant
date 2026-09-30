import type { Operation, ScopingSession, NodeRef } from '../domain/index.js';
import type { SectionCandidate } from '../domain/deliverables.js';
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface BoundedGenerationContext {
  seedId: string;
  targets: { id: string; candidate: SectionCandidate; inputs: { node: NodeRef; values: Record<string, unknown> }[] }[];
}
export interface ProviderRequest {
  operation: Operation;
  context: DeepReadonly<ScopingSession>;
  schemaVersion: string;
  requestedItemIds: readonly NodeRef[];
  signal?: AbortSignal;
  fixtureVariant?: string;
  boundedContext?: DeepReadonly<BoundedGenerationContext>;
}
export interface ProviderResult {
  output: unknown;
  metadata: { provider: string; mode: 'MOCK' | 'LIVE'; model?: string; fixtureVariant?: string };
}
export interface AIProvider { generate(request: ProviderRequest): Promise<ProviderResult>; }
