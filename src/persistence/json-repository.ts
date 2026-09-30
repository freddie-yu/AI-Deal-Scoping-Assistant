import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ScopingSessionSchema, SessionIdSchema, type ScopingSession } from '../domain/index.js';
import { ApplicationError, ConflictError, NotFoundError, PersistenceError, ValidationError } from '../application/errors.js';
import type { SessionRepository } from './repository.js';
import { validateScopeIntegrity, validateImmutableSources } from '../validation/scope-integrity.js';
const missing = (e: unknown) => e instanceof Error && 'code' in e && e.code === 'ENOENT';
export class JsonSessionRepository implements SessionRepository {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly directory: string;
  constructor(directory: string) { this.directory = resolve(directory); }
  private path(id: string, suffix = '.json') {
    if (!SessionIdSchema.safeParse(id).success) throw new ValidationError('Invalid session ID.', ['id']);
    return join(this.directory, `${id}${suffix}`);
  }
  private async serialize<T>(id: string, action: () => Promise<T>): Promise<T> {
    this.path(id);
    const previous = this.queues.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(action);
    this.queues.set(id, current);
    try { return await current; } finally { if (this.queues.get(id) === current) this.queues.delete(id); }
  }
  async load(id: string): Promise<ScopingSession> {
    const path = this.path(id);
    try {
      const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
      const session = ScopingSessionSchema.parse(raw);
      validateScopeIntegrity(session);
      if (session.id !== id) throw new PersistenceError();
      return session;
    } catch (error) {
      if (missing(error)) throw new NotFoundError();
      throw new PersistenceError('Stored session is unreadable or invalid. Its file and recovery snapshot were left unchanged.');
    }
  }
  private validate(session: ScopingSession) {
    const parsed = ScopingSessionSchema.safeParse(session);
    if (!parsed.success) throw new ValidationError('Session failed schema validation.', parsed.error.issues.map(i => i.path.join('.')));
    validateScopeIntegrity(parsed.data);
    return parsed.data;
  }
  private async replace(session: ScopingSession, previous?: ScopingSession) {
    const temporary = this.path(session.id, `.${randomUUID()}.tmp`);
    const backupTemporary = this.path(session.id, `.${randomUUID()}.previous.tmp`);
    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(temporary, JSON.stringify(session, null, 2), { flag: 'wx' });
      if (previous) {
        await writeFile(backupTemporary, JSON.stringify(previous, null, 2), { flag: 'wx' });
        await rename(backupTemporary, this.path(session.id, '.previous.json'));
      }
      await rename(temporary, this.path(session.id));
    } catch { throw new PersistenceError(); }
    finally { await Promise.all([rm(temporary, { force: true }), rm(backupTemporary, { force: true })]).catch(() => undefined); }
  }
  async create(session: ScopingSession) {
    const valid = this.validate(session);
    return this.serialize(valid.id, async () => {
      try { await this.load(valid.id); throw new ConflictError(); }
      catch (e) { if (!(e instanceof NotFoundError)) throw e; }
      await this.replace(valid);
    });
  }
  async save(session: ScopingSession, expectedRevision: number) {
    const valid = this.validate(session);
    return this.serialize(valid.id, async () => {
      const previous = await this.load(valid.id);
      if (previous.revision !== expectedRevision || valid.revision !== expectedRevision + 1 || valid.operationalRevision !== previous.operationalRevision) throw new ConflictError();
      validateImmutableSources(previous, valid);
      await this.replace(valid, previous);
    });
  }
  async delete(id: string, expectedRevision: number) {
    return this.serialize(id, async () => {
      if ((await this.load(id)).revision !== expectedRevision) throw new ConflictError();
      try { await rm(this.path(id, '.previous.json'), { force: true }); await rm(this.path(id)); }
      catch (e) { if (e instanceof ApplicationError) throw e; throw new PersistenceError('Could not delete the local session.'); }
    });
  }
  async operational(id: string, expectedRevision: number, update: (session: ScopingSession) => void) {
    return this.serialize(id, async () => {
      const previous = await this.load(id);
      if (previous.revision !== expectedRevision) throw new ConflictError();
      const next = structuredClone(previous); update(next); next.operationalRevision++;
      if (next.revision !== previous.revision) throw new ConflictError();
      const valid = this.validate(next); validateImmutableSources(previous, valid);
      await this.replace(valid, previous); return valid;
    });
  }
}
