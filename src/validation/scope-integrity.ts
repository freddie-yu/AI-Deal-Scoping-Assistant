import type { ScopingSession } from '../domain/index.js';
import { sourceHash, validateAnchor } from '../ingestion/sources.js';
import { validateScopeRecord } from '../application/scope-edits.js';
import { ValidationError } from '../application/errors.js';

export function validateScopeIntegrity(s: ScopingSession) {
  for (const doc of Object.values(s.documents)) {
    if (doc.hash !== sourceHash(doc.text)) throw new ValidationError('Source hash does not match the exact original text.', [`documents.${doc.id}.hash`]);
    let position = 0;
    doc.sectionIds.forEach((id, ordinal) => {
      const section = s.sourceSections[id];
      if (!section || section.documentId !== doc.id || section.ordinal !== ordinal || section.start !== position || section.end > doc.text.length || section.end <= section.start) throw new ValidationError('Source sections must cover the exact input in order.', [`sourceSections.${id}`]);
      position = section.end;
    });
    if (position !== doc.text.length || (doc.supersedesId && !s.documents[doc.supersedesId])) throw new ValidationError('Source version or section coverage is invalid.', [`documents.${doc.id}`]);
  }
  for (const section of Object.values(s.sourceSections)) if (!s.documents[section.documentId]?.sectionIds.includes(section.id)) throw new ValidationError('Orphan source section.', [`sourceSections.${section.id}`]);
  for (const kind of ['requirements', 'assumptions', 'questions'] as const) for (const r of Object.values(s[kind])) validateScopeRecord(s, kind, r);
  for (const section of Object.values(s.artifactSections)) if (section.payload.kind === 'Narrative') for (const paragraph of section.payload.paragraphs) paragraph.anchors.forEach(a => validateAnchor(s, a));
  for (const collection of ['documents', 'sourceSections', 'requirements', 'assumptions', 'questions', 'artifacts', 'artifactSections', 'generationRuns'] as const) for (const id of Object.keys(s[collection])) {
    const [prefix, suffix] = id.split('_'); const counter = s.idCounters[prefix as keyof typeof s.idCounters];
    if (counter === undefined || Number(suffix) > counter) throw new ValidationError('ID counters cannot reuse an existing identity.', [`idCounters.${prefix}`]);
  }
}
export function validateImmutableSources(previous: ScopingSession, next: ScopingSession) {
  for (const collection of ['documents', 'sourceSections'] as const) for (const [id, value] of Object.entries(previous[collection])) if (JSON.stringify(next[collection][id]) !== JSON.stringify(value)) throw new ValidationError('Stored source evidence is immutable. Save a new source version.', [`${collection}.${id}`]);
  for (const prefix of Object.keys(previous.idCounters) as (keyof ScopingSession['idCounters'])[]) if (next.idCounters[prefix] < previous.idCounters[prefix]) throw new ValidationError('ID counters cannot decrease.', [`idCounters.${prefix}`]);
}
