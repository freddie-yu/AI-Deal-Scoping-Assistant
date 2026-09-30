import { createHash } from 'node:crypto';
import type { ScopingSession, SourceAnchor, SourceDocument, SourceSection } from '../domain/index.js';
import { SourceAnchorSchema } from '../domain/index.js';
import { allocateId } from '../domain/ids.js';
import { ValidationError } from '../application/errors.js';

export const sourceHash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export type SourceStore = Pick<ScopingSession, 'documents' | 'sourceSections'>;

// Lines include their original newline. JS string positions are UTF-16 code units.
export function sectionRanges(text: string): Omit<SourceSection, 'id' | 'documentId'>[] {
  const sections: Omit<SourceSection, 'id' | 'documentId'>[] = [];
  let start = 0; let heading: string | undefined;
  for (const match of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    if (!match[0].length) continue;
    const end = start + match[0].length;
    const found = /^ {0,3}#{1,6}\s+(.+?)(?:\r?\n|\r)?$/.exec(match[0]);
    if (found) heading = found[1]!.trim();
    sections.push({ ordinal: sections.length, start, end, ...(heading ? { heading } : {}) });
    start = end;
  }
  return sections;
}
export function addSource(session: ScopingSession, input: { title: string; text: string; inputKind: 'PASTED_TEXT' | 'PASTED_MARKDOWN' }): SourceDocument {
  const previous = session.documents[session.activeSourceIds[0] ?? ''];
  const id = allocateId(session, 'DOC');
  const sections = sectionRanges(input.text).map(range => ({ ...range, id: allocateId(session, 'SRC'), documentId: id }));
  const document: SourceDocument = { ...input, id, version: previous ? previous.version + 1 : 1, hash: sourceHash(input.text), sectionIds: sections.map(s => s.id), ...(previous ? { supersedesId: previous.id } : {}) };
  session.documents[id] = document;
  for (const section of sections) session.sourceSections[section.id] = section;
  session.activeSourceIds = [id];
  session.collectionCounters.documents++; session.collectionCounters.sourceSections++;
  // Replacing evidence changes review eligibility, never old offsets or downstream payloads.
  for (const record of [...Object.values(session.requirements), ...Object.values(session.assumptions), ...Object.values(session.questions)]) {
    if (record.lifecycle === 'ACTIVE') record.review = 'DRAFT';
  }
  return document;
}
export function sectionAt(store: SourceStore, documentId: string, position: number): SourceSection {
  const document = store.documents[documentId];
  const section = document?.sectionIds.map(id => store.sourceSections[id]).find(s => s && s.start <= position && position < s.end);
  if (!Number.isInteger(position) || !section) throw new ValidationError('Source position does not resolve to a stored section.', ['source.position']);
  return section;
}
export function validateAnchor(store: SourceStore, value: unknown, path = 'evidence'): SourceAnchor {
  const parsed = SourceAnchorSchema.safeParse(value);
  if (!parsed.success) throw new ValidationError('Invalid source anchor offsets or fields.', [path]);
  const anchor = parsed.data; const document = store.documents[anchor.documentId]; const section = store.sourceSections[anchor.sectionId];
  if (!document || !section || section.documentId !== document.id || !document.sectionIds.includes(section.id)) throw new ValidationError('Source document/section reference does not exist or does not match.', [path]);
  if (section.start < 0 || section.end > document.text.length || anchor.start < section.start || anchor.end > section.end || document.text.slice(anchor.start, anchor.end) !== anchor.excerpt) throw new ValidationError('Source excerpt must exactly match the original text within its declared section.', [path]);
  return anchor;
}
export function anchorAt(store: SourceStore, documentId: string, start: number, end: number, relation: SourceAnchor['relation']): SourceAnchor {
  const section = sectionAt(store, documentId, start);
  return validateAnchor(store, { documentId, sectionId: section.id, start, end, relation, excerpt: store.documents[documentId]!.text.slice(start, end) });
}
export const exactExcerpt = (store: SourceStore, anchor: SourceAnchor) => validateAnchor(store, anchor).excerpt;

// Providers cite a section and quote, never canonical offsets. Ambiguous quotes fail.
export function anchorForQuote(store: SourceStore, citation: { documentId: string; sectionId: string; excerpt: string; relation: SourceAnchor['relation'] }, path = 'evidence'): SourceAnchor {
  const section = store.sourceSections[citation.sectionId]; const document = store.documents[citation.documentId];
  if (!section || !document || section.documentId !== document.id) throw new ValidationError('Unknown source section. Select a section supplied to analysis.', [path]);
  const text = document.text.slice(section.start, section.end); const offset = text.indexOf(citation.excerpt);
  if (!citation.excerpt || offset < 0 || text.indexOf(citation.excerpt, offset + 1) >= 0) throw new ValidationError('Excerpt is missing or ambiguous in its source section. Supply a unique exact quote.', [path]);
  return validateAnchor(store, { ...citation, start: section.start + offset, end: section.start + offset + citation.excerpt.length }, path);
}
