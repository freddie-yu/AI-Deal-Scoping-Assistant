import type { SessionRepository } from '../persistence/repository.js';
import { EstimationCommands } from './estimation.js';
import { ConflictError } from './errors.js';
import { parseCommand } from './scope.js';
import { RevisionCommandSchema } from './scope-edits.js';
export class ImpactCommands {
  constructor(private readonly repository: SessionRepository) {}
  async read(id: string) {
    const s = await this.repository.load(id);
    return { impact: s.lastImpact ?? null, current: !!s.lastImpact && s.lastImpact.evaluatedRevision === s.revision };
  }
  async recalculate(id: string, input: unknown) {
    const { expectedRevision } = parseCommand(RevisionCommandSchema, input);
    const s = await this.repository.load(id);
    if (s.revision !== expectedRevision || s.lastImpact?.evaluatedRevision !== expectedRevision) throw new ConflictError();
    return new EstimationCommands(this.repository).calculate(id, input);
  }
}
