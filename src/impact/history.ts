import type { ScopingSession } from '../domain/index.js';
import { diffSessions } from './diff.js';
import { hash } from '../estimation/config.js';
/** One latest human change, not an event log or a second domain model. */
export function retainControlledChange(before: ScopingSession, after: ScopingSession) {
  if (!Object.values(before.artifactSections).some(a => a.payload.kind === 'EstimateSummary')) return;
  const diff = diffSessions(before, after);
  const edits = diff.changes.filter(c => {
    const n = c.node;
    if (['Requirement','Assumption','Question'].includes(n.kind)) return true;
    if (n.kind === 'ArtifactSection') {
      const a = after.artifactSections[n.id];
      return a?.payload.kind === 'EstimationUnit' && a.lastChangedBy === 'HUMAN' &&
        c.fields.some(f => ['exists', 'title', 'payload.exclusionReason', 'payload.workstreamId', 'payload.source.name', 'payload.source.boundary'].includes(f) || f.startsWith('payload.inclusion'));
    }
    return n.kind === 'CONFIGURATION' && !!before.configuration.entries[n.key];
  });
  if (edits.length && after.lastImpact) {
    after.controlledChange = { impact: structuredClone(after.lastImpact), updatedSectionIds: [], evaluatedRevision: after.revision };
    // Track the explicit edited records, not incidental calculated outputs.
    after.controlledChange.impact.change = { ...diff, changes: edits };
  }
  const record = after.controlledChange;
  if (!record) return;
  record.evaluatedRevision = after.revision;
  const changed = Object.values(after.artifactSections).filter(a => before.artifactSections[a.id] && hash(a.payload) !== hash(before.artifactSections[a.id]!.payload) && ['MOCK','AI','ENGINE'].includes(a.lastChangedBy)).map(a => a.id);
  record.updatedSectionIds = [...new Set([...record.updatedSectionIds,...changed])].sort();
}


