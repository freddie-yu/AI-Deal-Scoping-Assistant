import React from 'react';
import type { ScopingSession, SourceAnchor } from '../../domain/index.js';
export function SourceEvidence({ session, anchors }: { session: ScopingSession; anchors: SourceAnchor[] }) {
  return <div className="evidence" data-testid="source-evidence">{anchors.map((anchor, i) => {
    const document = session.documents[anchor.documentId]; const section = session.sourceSections[anchor.sectionId];
    return <div key={i}><p className="eyebrow">{anchor.relation} · {anchor.documentId} / {anchor.sectionId} · VERSION {document?.version}</p>
      <p className="muted">{document?.title} · {section?.heading ?? `Section ${(section?.ordinal ?? 0) + 1}`} · UTF-16 [{anchor.start}, {anchor.end}){!session.activeSourceIds.includes(anchor.documentId) && ' · Retained previous source'}</p>
      <blockquote><pre>{anchor.excerpt}</pre></blockquote><details><summary>View exact source section</summary><pre>{document?.text.slice(section?.start, section?.end)}</pre></details>
      <details><summary>View complete original input</summary><pre>{document?.text}</pre><p className="muted">SHA-256: {document?.hash}</p></details>
    </div>;
  })}</div>;
}
