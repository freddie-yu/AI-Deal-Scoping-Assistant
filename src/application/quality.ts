import { z } from 'zod';
import type { SessionRepository } from '../persistence/repository.js';
import { parseCommand } from './scope.js';
import { evaluateQuality, gateCurrent } from '../quality/index.js';
import { qualityCoverage } from '../traceability/quality-coverage.js';

const evaluateCommand = z.object({ expectedRevision: z.number().int().positive(), diagramRendered: z.boolean().optional() }).strict();
export class QualityCommands {
  constructor(private readonly repository: SessionRepository) {}
  async evaluate(id: string, input: unknown) {
    const { expectedRevision, diagramRendered } = parseCommand(evaluateCommand, input);
    // Evaluation and storage share the repository's serialized revision guard.
    return this.repository.operational(id, expectedRevision, s => { s.gate = evaluateQuality(s, { diagramRendered }); });
  }
  async read(id: string) {
    const s = await this.repository.load(id);
    return { gate: s.gate ?? null, current: gateCurrent(s), coverage: qualityCoverage(s) };
  }
}
