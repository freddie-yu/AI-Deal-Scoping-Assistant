import type { ScopingSession } from '../domain/index.js';
export interface SessionRepository {
  create(session: ScopingSession): Promise<void>;
  load(id: string): Promise<ScopingSession>;
  save(session: ScopingSession, expectedRevision: number): Promise<void>;
  operational(id: string, expectedRevision: number, update: (session: ScopingSession) => void): Promise<ScopingSession>;
  delete(id: string, expectedRevision: number): Promise<void>;
}
