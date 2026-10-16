import type { SessionRepository } from '../../src/persistence/repository.js';
import { approvedSeed, generateAndAccept } from './phase2.js';
import { EstimationCommands } from '../../src/application/estimation.js';
export async function estimatedSeed(repo: SessionRepository, seedId = 'modernization') {
  let s = await approvedSeed(repo, seedId);
  for (const op of ['prd-scope', 'architecture', 'strategies', 'delivery'] as const) s = await generateAndAccept(repo, s, op);
  const e = new EstimationCommands(repo);
  s = await e.prepare(s.id, { expectedRevision: s.revision });
  s = await e.review(s.id, { expectedRevision: s.revision, confirmed: true });
  return e.calculate(s.id, { expectedRevision: s.revision });
}

