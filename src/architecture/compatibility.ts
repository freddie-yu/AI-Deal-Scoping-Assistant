import type { z } from 'zod';
import { TechnologyConstraintSchema } from '../domain/scope.js';
type TechnologyConstraint = z.infer<typeof TechnologyConstraintSchema>;
export const COMPATIBILITY_VERSION = 'phase2-1';
export const COMPATIBILITY_RULES = [
  { kind: 'DATABASE_COMPATIBILITY', value: 'postgresql', technology: 'aws:rds-postgresql', status: 'COMPATIBLE', id: 'postgresql-rds', reason: 'Explicit PostgreSQL-compatible database mapping.' },
  { kind: 'DATABASE_COMPATIBILITY', value: 'postgresql', technology: 'aws:s3', status: 'CONFLICT', id: 'postgresql-s3', reason: 'Object storage is not a PostgreSQL-compatible transactional database.' },
  { kind: 'ALLOWED_RUNTIME', value: 'jvm', technology: 'python-fastapi', status: 'CONFLICT', id: 'jvm-python', reason: 'Python/FastAPI does not run on the required JVM runtime.' },
] as const;
export function compatibilityStatus(c: TechnologyConstraint, technology?: string) {
  const matches = c.values.map(value => {
    if (c.kind === 'PROHIBITED_TECHNOLOGY' && value === technology) return { status: 'CONFLICT' as const, id: 'exact-prohibition', reason: 'Explicitly prohibited technology.' };
    return COMPATIBILITY_RULES.find(rule => rule.kind === c.kind && rule.value === value && rule.technology === technology);
  });
  const statuses = matches.map(m => m?.status ?? 'UNKNOWN');
  const status = c.kind === 'PROHIBITED_TECHNOLOGY'
    ? statuses.includes('CONFLICT') ? 'CONFLICT' : statuses.every(s => s === 'COMPATIBLE') ? 'COMPATIBLE' : 'UNKNOWN'
    : statuses.includes('COMPATIBLE') ? 'COMPATIBLE' : statuses.every(s => s === 'CONFLICT') ? 'CONFLICT' : 'UNKNOWN';
  return { status, ruleIds: matches.flatMap(m => m ? [m.id] : []), reason: status === 'UNKNOWN' ? 'No explicit scoped compatibility rule proves this choice; human validation required.' : matches.filter(m => m?.status === status).map(m => m!.reason).join(' ') };
}
