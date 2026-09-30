import React, { useState } from 'react';
import type { Requirement, ScopingSession } from '../../domain/index.js';
import type { Mutate } from '../api.js';
import { SourceEvidence } from './SourceEvidence.js';

export function RequirementDetail({ requirement: r, session, mutate, busy }: { requirement: Requirement; session: ScopingSession; mutate: Mutate; busy: boolean }) {
  const [editing, setEditing] = useState(false); const [error, setError] = useState('');
  const [users, setUsers] = useState(r.measures?.expectedUsers?.state === 'KNOWN' ? String(r.measures.expectedUsers.value.value) : '');
  const [scaleBasis, setScaleBasis] = useState('Reviewer supplied planning target; requires validation with the customer.');
  const [draft, setDraft] = useState({ description: r.description, priority: r.priority, type: r.type, origin: r.origin, basis: r.basis ?? '', inclusion: r.inclusion, exclusionReason: r.exclusionReason ?? '', dependencyIds: r.dependencyIds.join(', '), assumptionIds: r.assumptionIds.join(', '), questionIds: r.questionIds.join(', ') });
  async function act(path: string, body?: object, method?: 'POST' | 'PATCH') { setError(''); try { await mutate(path, body, method); setEditing(false); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); } }
  const links = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);
  return <section className="panel detail" data-testid="requirement-detail" aria-label={`Requirement ${r.id}`}>
    <div className="row"><h3>{r.id} · Requirement detail</h3><span className={`chip ${r.review.toLowerCase()}`}>{r.review}</span></div>
    <p><span className={`chip ${r.origin.toLowerCase()}`}>{r.origin}</span> <span className="chip">{r.priority}</span> <span className="chip">{r.inclusion}</span></p>
    <p>{r.description}</p><p className="muted">Basis: {r.basis ?? 'Exact customer evidence.'} · Revision {r.revision}{r.supersedesId && ` · Replaces ${r.supersedesId}`}</p>
    {r.exclusionReason && <p>Exclusion reason: {r.exclusionReason}</p>}
    <p className="muted">Dependencies: {r.dependencyIds.join(', ') || 'None'} · Assumptions: {r.assumptionIds.join(', ') || 'None'} · Questions: {r.questionIds.join(', ') || 'None'}</p>
    {Object.entries(r.measures ?? {}).map(([key, value]) => <p key={key}><strong>{key}</strong>: {value?.state === 'KNOWN' ? `${value.value.value} ${value.value.unit}` : value?.state === 'UNRESOLVED' ? `UNRESOLVED — ${value.reason} (${value.questionIds.join(', ')})` : value?.reason}</p>)}
    {r.measures?.expectedUsers?.state === 'KNOWN' && <details><summary>Change expected users</summary><p>Record a new planning assumption. The original customer quote remains unchanged; review the new assumption and edited requirement before approving scope.</p><label>Expected users target<input type="number" min="1" max="1000000000" value={users} onChange={e => setUsers(e.target.value)} /></label><label>Scale change basis<textarea value={scaleBasis} onChange={e => setScaleBasis(e.target.value)} /></label><button disabled={busy || !users || !scaleBasis.trim()} onClick={() => void act(`requirements/${r.id}/expected-users`, { value: Number(users), basis: scaleBasis })}>Record scale change</button></details>}
    {error && <p role="alert" className="error">{error}</p>}
    {editing ? <form onSubmit={e => { e.preventDefault(); void act(`requirements/${r.id}`, { patch: { ...draft, exclusionReason: draft.exclusionReason || undefined, basis: draft.basis || undefined, dependencyIds: links(draft.dependencyIds), assumptionIds: links(draft.assumptionIds), questionIds: links(draft.questionIds) } }, 'PATCH'); }}>
      <label>Description<textarea required value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <div className="field-grid"><label>Requirement priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Requirement['priority'] })}>{['HIGH', 'MEDIUM', 'LOW'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Requirement type<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Requirement['type'] })}>{['BR', 'FR', 'NFR', 'INT', 'DATA', 'SEC'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Requirement origin<select value={draft.origin} onChange={e => setDraft({ ...draft, origin: e.target.value as Requirement['origin'] })}>{['CUSTOMER_STATED', 'AI_INFERRED', 'ASSUMED'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Scope inclusion<select value={draft.inclusion} onChange={e => setDraft({ ...draft, inclusion: e.target.value as Requirement['inclusion'] })}><option>INCLUDED</option><option>EXCLUDED</option></select></label></div>
      <p className="muted">A changed meaning needs explicit provenance review. Customer-stated descriptions must match direct evidence. Inferences and assumptions retain the quote as CONTEXT. Type correction creates a new ID and retires this item.</p>
      <label>Interpretation basis<textarea value={draft.basis} required={draft.origin !== 'CUSTOMER_STATED'} onChange={e => setDraft({ ...draft, basis: e.target.value })} /></label>
      {draft.inclusion === 'EXCLUDED' && <label>Exclusion reason<input required value={draft.exclusionReason} onChange={e => setDraft({ ...draft, exclusionReason: e.target.value })} /></label>}
      <label>Dependency IDs (comma separated)<input value={draft.dependencyIds} onChange={e => setDraft({ ...draft, dependencyIds: e.target.value })} /></label>
      <label>Assumption IDs (comma separated)<input value={draft.assumptionIds} onChange={e => setDraft({ ...draft, assumptionIds: e.target.value })} /></label>
      <label>Question IDs (comma separated)<input value={draft.questionIds} onChange={e => setDraft({ ...draft, questionIds: e.target.value })} /></label>
      <div className="actions"><button className="primary" disabled={busy}>Save requirement</button><button type="button" onClick={() => setEditing(false)}>Cancel edit</button></div>
    </form> : <div className="actions"><button onClick={() => setEditing(true)}>Edit requirement</button><button disabled={busy || r.review === 'REVIEWED'} onClick={() => void act(`requirements/${r.id}/review`)}>Review {r.id}</button></div>}
    <h4>Originating customer text</h4><SourceEvidence session={session} anchors={r.evidence} />
  </section>;
}
