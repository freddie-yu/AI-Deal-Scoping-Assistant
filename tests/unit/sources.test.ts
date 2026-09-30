import { expect, it } from 'vitest';
import { newSession } from '../../src/application/sessions.js';
import { addSource, anchorAt, exactExcerpt, sectionAt, sourceHash, validateAnchor } from '../../src/ingestion/sources.js';
const fresh = () => newSession({ customerName: 'C', opportunityName: 'O' });
it('sections exact UTF-16 input including CRLF, astral characters and whitespace', () => {
  const s = fresh(); const text = '  # Heading\r\n\r\n🧭 Customer text.  \n尾行';
  const d = addSource(s, { title: 'Discovery', text, inputKind: 'PASTED_MARKDOWN' });
  expect(d.text).toBe(text); expect(d.hash).toBe(sourceHash(text));
  expect(d.sectionIds.map(id => { const p = s.sourceSections[id]!; return text.slice(p.start, p.end); }).join('')).toBe(text);
  expect(d.sectionIds.map(id => s.sourceSections[id]!.ordinal)).toEqual([0, 1, 2, 3]);
  const start = text.indexOf('🧭'); const anchor = anchorAt(s, d.id, start, start + 2, 'DIRECT');
  expect(exactExcerpt(s, anchor)).toBe('🧭'); expect(sectionAt(s, d.id, start).heading).toBe('Heading');
  for (const edit of [{ start: -1 }, { end: 999 }, { excerpt: 'invented' }, { sectionId: 'SRC_99' }, { documentId: 'DOC_99' }, { end: start }]) expect(() => validateAnchor(s, { ...anchor, ...edit })).toThrow();
});
it('retains old immutable documents and anchors on replacement and never recycles IDs', () => {
  const s = fresh(); const first = addSource(s, { title: 'One', text: 'Old input', inputKind: 'PASTED_TEXT' });
  const anchor = anchorAt(s, first.id, 0, 3, 'CONTEXT'); const before = structuredClone(first);
  const second = addSource(s, { title: 'Two', text: 'New input', inputKind: 'PASTED_TEXT' });
  expect(second).toMatchObject({ id: 'DOC_02', version: 2, supersedesId: first.id });
  expect(s.documents[first.id]).toEqual(before); expect(exactExcerpt(s, anchor)).toBe('Old'); expect(s.activeSourceIds).toEqual([second.id]);
});
