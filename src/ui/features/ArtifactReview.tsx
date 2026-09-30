import React from 'react';
import type { ArtifactSection, ScopingSession } from '../../domain/index.js';
import { SourceEvidence } from './SourceEvidence.js';
import { AWS_CATALOG, isServiceKey } from '../../architecture/catalog.js';
const words = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
function Value({ value }: { value: unknown }) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.length ? <ul>{value.map((v, i) => <li key={i}><Value value={v} /></li>)}</ul> : <span className="muted">None recorded</span>;
  if (typeof value === 'object') {
    const r = value as Record<string, unknown>;
    if (r.state) return <span><span className="chip">{String(r.state)}</span> {String(r.value ?? r.reason)}{Array.isArray(r.questionIds) && r.questionIds.length > 0 && ` (${r.questionIds.join(', ')})`}</span>;
    if (r.kind === 'COMPONENT') return <span>Component {String(r.sectionId)}</span>;
    if (r.kind === 'EXTERNAL_SYSTEM') return <span>{String(r.name)} · External · {String(r.description)}</span>;
    if (r.source && r.rationale) return <span>{String((r.source as { id: string }).id)}: {String(r.rationale)}</span>;
    return <dl>{Object.entries(r).filter(([k]) => !['anchors', 'grounding', 'origin'].includes(k)).map(([k, v]) => <React.Fragment key={k}><dt>{words(k)}</dt><dd><Value value={v} /></dd></React.Fragment>)}</dl>;
  }
  return <span>{String(value)}</span>;
}
export function ArtifactReview({ section: a, session, pending, busy, accept, reject, warnings = [] }: { section: ArtifactSection; session: ScopingSession; pending: boolean; busy: boolean; accept?: () => void; reject?: () => void; warnings?: string[] }) {
  const p = a.payload;
  return <article className="panel artifact-card" data-testid="artifact-section" id={`section-${a.id}`}>
    <div className="row"><h3>{a.title}</h3><span className={`chip ${pending || a.freshness === 'STALE' ? 'draft' : 'reviewed'}`}>{pending ? 'PROPOSAL' : a.review} · {a.freshness} · {a.id}</span></div>
    {a.freshness === 'STALE' && <p className="error">STALE — retained accepted content. Changed source: {a.staleCauses.map(n => 'key' in n ? n.key : 'id' in n ? n.id : n.kind).join(', ')}. Inspect Change impact for the consumed field and path.</p>}
    <p className="eyebrow">{p.kind} · MOCK · AI-generated recommendation</p>
    {p.kind === 'Capability' && <p><span className="chip">{p.classification}</span> <span className="chip">{p.inclusion}</span> <span className="chip">{p.priority}</span> · {p.module}</p>}
    {p.kind === 'ArchitectureComponent' && <p><strong>{isServiceKey(p.catalogServiceKey) ? AWS_CATALOG[p.catalogServiceKey].name : p.catalogServiceKey}</strong> · AWS</p>}
    {a.applicability && <p><Value value={a.applicability} /></p>}
    {warnings.map((w, i) => <p key={i} className="error">{w}</p>)}
    {p.kind === 'Narrative' ? <details open={p.topic === 'OVERVIEW'}><summary>Read structured {words(p.topic).toLowerCase()}</summary>{p.paragraphs.map((paragraph, i) => <p className="narrative-text" key={i}><span className="chip">{paragraph.origin}</span> {paragraph.text}</p>)}</details> : <details><summary>Inspect structured {p.kind} details</summary><Value value={p} /></details>}
    <details><summary>Why? Grounding and source evidence</summary>{a.grounding.map(g => {
      const record = g.source.kind === 'Requirement' ? session.requirements[g.source.id] : session.assumptions[g.source.id];
      return <div key={`${g.source.kind}-${g.source.id}`} className="grounding"><p>{g.rationale}</p><details><summary>Inspect linked {g.source.id}</summary>{record ? <><p>{'description' in record ? record.description : record.statement}</p><p className="muted">{record.review} · revision {record.revision}{'validation' in record ? ` · ${record.validation}` : ` · ${record.origin}`}</p><SourceEvidence session={session} anchors={'evidence' in record ? record.evidence : record.sources} /></> : <p className="error">Source record is unavailable; this recommendation requires review.</p>}</details></div>;
    })}<p className="muted">Dependencies: {a.dependencies?.join(', ') || 'No additional artifact dependency'} · {a.freshness}</p></details>
    {pending && <div className="actions"><button disabled={busy} className="primary" onClick={accept} aria-label={`Accept ${a.id}`}>Accept section</button><button disabled={busy} onClick={reject} aria-label={`Reject ${a.id}`}>Reject section</button></div>}
  </article>;
}
