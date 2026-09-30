import type { ScopingSession } from './session.js';
export function allocateId(session: ScopingSession, prefix: keyof ScopingSession['idCounters']): string {
  return `${prefix}_${String(++session.idCounters[prefix]).padStart(2, '0')}`;
}
