import { ScopeCommands } from '../../src/application/scope.js';
import { SessionCommands } from '../../src/application/sessions.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import type { ScopingSession } from '../../src/domain/index.js';
import type { SessionRepository } from '../../src/persistence/repository.js';
import type { Phase2Operation } from '../../src/domain/deliverables.js';
export async function approvedSeed(repo: SessionRepository, seedId = 'modernization') {
  const scope = new ScopeCommands(repo); let s = await new SessionCommands(repo).createSeed({ seedId });
  s = await scope.analyze(s.id, { expectedRevision: s.revision });
  for (const kind of ['requirements', 'assumptions', 'questions'] as const) for (const r of Object.values(s[kind]).filter(r => r.lifecycle === 'ACTIVE')) s = await scope.review(s.id, kind, r.id, { expectedRevision: s.revision });
  return scope.approve(s.id, { expectedRevision: s.revision });
}
export async function generateAndAccept(repo: SessionRepository, s: ScopingSession, operation: Phase2Operation) {
  const commands = new DeliverableCommands(repo); s = await commands.generate(s.id, { expectedRevision: s.revision, operation });
  const run = Object.values(s.generationRuns).at(-1)!;
  for (const p of run.proposals) if ('id' in p.target) s = await commands.review(s.id, run.id, p.target.id, { expectedRevision: s.revision, decision: 'ACCEPTED' });
  return s;
}
