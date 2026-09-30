import type { ScopingSession, ChangeSet, NodeRef } from '../domain/index.js';
import { isRegisteredFieldPath } from '../domain/field-paths.js';
import { canonicalJSON, hash } from '../estimation/config.js';

const metadata = new Set(['revision', 'review', 'reviewedRevision', 'reviewedAt', 'lastChangedBy', 'generationRunId', 'freshness', 'staleCauses', 'id', 'displayId']);
function fields(before: unknown, after: unknown, path = ''): string[] {
  if (canonicalJSON(before) === canonicalJSON(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const b = before as Record<string, unknown>, a = after as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort().filter(k => path || !metadata.has(k));
    const nested = keys.flatMap(k => { const child = path ? `${path}.${k}` : k; return isRegisteredFieldPath(child) ? fields(b[k], a[k], child) : []; });
    if (nested.length) return nested;
    if (!path) return [];
  }
  return isRegisteredFieldPath(path) ? [path] : [];
}
const get = (v: unknown, path: string) => path === 'exists' ? v !== undefined : path.split('.').reduce<unknown>((a, key) => a && typeof a === 'object' ? (a as Record<string, unknown>)[key] : undefined, v);
export function diffValue(value: unknown) {
  if (typeof value === 'boolean') return { kind: 'BOOLEAN' as const, value };
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'NUMBER' as const, value, unit: 'scalar' };
  return { kind: 'TEXT' as const, value: typeof value === 'string' && value.length ? value : canonicalJSON(value) };
}
export function diffSessions(before: ScopingSession, after: ScopingSession): ChangeSet {
  const changes: ChangeSet['changes'] = [], membershipChanges: ChangeSet['membershipChanges'] = [];
  const record = (node: NodeRef, b: unknown, a: unknown) => {
    const changed = b === undefined || a === undefined ? ['exists'] : fields(b, a);
    if (!changed.length) return;
    const oldRevision = b && typeof b === 'object' && 'revision' in b ? Number(b.revision) : 0;
    const newRevision = a && typeof a === 'object' && 'revision' in a ? Number(a.revision) : 0;
    const fieldChanges = changed.map(field => ({ field, before: diffValue(get(b, field)), after: diffValue(get(a, field)) }));
    changes.push({ node, fields: changed, oldRevision, newRevision, before: fieldChanges.map(c => c.before), after: fieldChanges.map(c => c.after), fieldChanges });
  };
  for (const [collection, kind] of [['requirements', 'Requirement'], ['assumptions', 'Assumption'], ['questions', 'Question'], ['artifactSections', 'ArtifactSection'], ['artifacts', 'Artifact'], ['documents', 'SourceDocument'], ['sourceSections', 'SourceSection']] as const) {
    const b = before[collection], a = after[collection]; const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    for (const id of keys) record({ kind, id }, b[id], a[id]);
    const added = keys.filter(id => !b[id]), removed = keys.filter(id => !a[id]);
    if (added.length || removed.length) membershipChanges.push({ collection: { kind: 'COLLECTION', name: collection }, added: added.map(id => ({ kind, id })), removed: removed.map(id => ({ kind, id })) });
  }
  for (const key of [...new Set([...Object.keys(before.configuration.entries), ...Object.keys(after.configuration.entries)])].sort()) record({ kind: 'CONFIGURATION', id: 'CFG_01', key }, before.configuration.entries[key], after.configuration.entries[key]);
  // Session context/source selection are domain values; operational snapshots are not.
  record({ kind: 'ScopingSession', id: after.id }, { context: before.context, activeSourceIds: before.activeSourceIds }, { context: after.context, activeSourceIds: after.activeSourceIds });
  return { id: `change-${hash([before.revision, after.revision, changes, membershipChanges]).slice(0, 20)}`, baseSessionRevision: before.revision, currentSessionRevision: after.revision, changes, membershipChanges };
}
