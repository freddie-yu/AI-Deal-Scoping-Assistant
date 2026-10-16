import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionRepository } from '../persistence/repository.js';
import type { ScopingSession } from '../domain/index.js';
import { parseCommand } from './scope.js';
import { ConflictError, ValidationError } from './errors.js';
import { evaluateQuality, gateCurrent } from '../quality/index.js';
import { renderPackage, findingsHash } from '../export/index.js';
const request = z.object({ expectedRevision: z.number().int().positive(), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export class ExportCommands {
  constructor(private readonly repository: SessionRepository) {}
  private current(s: ScopingSession) {
    if (!gateCurrent(s)) throw new ConflictError();
    // Preserve a persisted browser rendering failure. Only an explicit new gate
    // evaluation can replace it; API export cannot silently remove that error.
    const gate = evaluateQuality(s, { ...(s.gate!.issues.some(i => i.ruleId === 'diagram-render') ? { diagramRendered: false } : {}) });
    if (findingsHash(gate) !== findingsHash(s.gate!)) throw new ConflictError();
    return renderPackage(s);
  }
  async preview(id: string) {
    return this.current(await this.repository.load(id));
  }
  async acknowledge(id: string, input: unknown) {
    const args = parseCommand(request.extend({ confirmed: z.literal(true) }), input);
    return this.repository.operational(id, args.expectedRevision, s => {
      const p = this.current(s);
      if (p.snapshotHash !== args.snapshotHash) throw new ConflictError();
      if (p.gate.status === 'BLOCKED') throw new ValidationError('Export blocked: repair errors and rerun quality.', ['gate']);
      if (p.gate.status !== 'REVIEW_REQUIRED') throw new ValidationError('This gate does not require warning acknowledgment.', ['gate']);
      s.gate!.acknowledgment = { revision: s.revision, findingsHash: p.basis.findingsHash, timestamp: new Date().toISOString() };
    });
  }
  async download(id: string, input: unknown) {
    const args = parseCommand(request, input);
    let rendered: ReturnType<typeof renderPackage> | undefined;
    const saved = await this.repository.operational(id, args.expectedRevision, s => {
      const p = this.current(s);
      if (p.snapshotHash !== args.snapshotHash) throw new ConflictError();
      if (p.gate.status === 'BLOCKED') throw new ValidationError('Export blocked: ' + p.gate.issues.filter(i => i.blocking).map(i => i.message).join(' '), ['gate']);
      if (!p.exportReady) throw new ValidationError('Explicit acknowledgment of the current warnings is required before export.', ['gate.acknowledgment']);
      rendered = p;
      const receipt = { id: 'EXPORT_' + randomUUID(), revision: s.revision, templateVersion: p.basis.templateVersion, disclaimerVersion: p.basis.disclaimerVersion, gateId: p.basis.gateId, gateRuleVersion: p.basis.gateRuleVersion, findingsHash: p.basis.findingsHash, timestamp: new Date().toISOString(), fileHash: p.fileHash, snapshotHash: p.snapshotHash, sectionRevisions: p.basis.sectionRevisions, estimationRuleSet: p.basis.estimationRuleSet, ...(s.gate!.acknowledgment ? { acknowledgment: s.gate!.acknowledgment } : {}) };
      // Receipts contain evidence only, never editable package content.
      (s.exportReceipts ??= []).push(receipt); s.exportReceipt = receipt;
    });
    return { ...rendered!, receipt: saved.exportReceipt! };
  }
}

