import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ScopingSessionSchema, text } from '../domain/index.js';
import type { SessionRepository } from '../persistence/repository.js';
import { ValidationError } from './errors.js';
import { loadSeed } from '../seeds/loader.js';
import { SeedIdSchema } from '../seeds/schema.js';
import { addSource } from '../ingestion/sources.js';
export const CreateSessionSchema = z.object({ customerName: text.max(200), opportunityName: text.max(200) }).strict();
export function newSession(input: z.infer<typeof CreateSessionSchema>) {
  return ScopingSessionSchema.parse({
    id: randomUUID(), schemaVersion: '1', revision: 1, context: { ...CreateSessionSchema.parse(input), analysisSectionIds: [] }, providerMode: 'MOCK',
    idCounters: { DOC: 0, SRC: 0, BR: 0, FR: 0, NFR: 0, INT: 0, DATA: 0, SEC: 0, ASM: 0, Q: 0, ART: 0, AS: 0, RUN: 0 },
    collectionCounters: { documents: 0, sourceSections: 0, requirements: 0, assumptions: 0, questions: 0, artifacts: 0, artifactSections: 0, generationRuns: 0 },
    activeSourceIds: [], documents: {}, sourceSections: {}, requirements: {}, assumptions: {}, questions: {}, artifacts: {}, artifactSections: {}, generationRuns: {},
    configuration: { id: 'CFG_01', revision: 1, entries: {} }, scopeReviewFingerprint: null,
  });
}
export class SessionCommands {
  constructor(private readonly repository: SessionRepository) {}
  async create(input: unknown) {
    const parsed = CreateSessionSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError(undefined, parsed.error.issues.map(i => i.path.join('.')));
    const session = newSession(parsed.data); await this.repository.create(session); return session;
  }
  load(id: string) { return this.repository.load(id); }
  async seeds() { return Promise.all(SeedIdSchema.options.map(async id => { const s = await loadSeed(id); return { id, title: s.title, description: s.description }; })); }
  async createSeed(input: unknown) {
    const parsed = z.object({ seedId: SeedIdSchema }).strict().safeParse(input);
    if (!parsed.success) throw new ValidationError('Select one of the four supported seeds.', ['seedId']);
    const seed = await loadSeed(parsed.data.seedId);
    if (!seed.input) throw new ValidationError('This seed has no Phase 1 input.', ['seedId']);
    const session = newSession({ customerName: seed.context.customerName, opportunityName: seed.context.opportunityName });
    session.seedId = seed.id; addSource(session, seed.input); await this.repository.create(session); return session;
  }
  async delete(id: string, input: unknown) {
    const parsed = z.object({ expectedRevision: z.number().int().positive() }).strict().safeParse(input);
    if (!parsed.success) throw new ValidationError('Deletion requires the expected session revision.', ['expectedRevision']);
    await this.repository.delete(id, parsed.data.expectedRevision);
  }
}
