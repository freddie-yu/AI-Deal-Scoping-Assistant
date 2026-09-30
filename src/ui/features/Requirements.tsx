import React, { useEffect, useState } from 'react';
import type { ScopingSession } from '../../domain/index.js';
import type { Mutate, ScopeStatus } from '../api.js';
import { RequirementDetail } from './RequirementDetail.js';
import { AssumptionsQuestions } from './AssumptionsQuestions.js';

export function Requirements({ session, mutate, busy, scope }: { session: ScopingSession; mutate: Mutate; busy: boolean; scope: ScopeStatus | null }) {
  const document = session.documents[session.activeSourceIds[0] ?? ''];
  const [text, setText] = useState(document?.text ?? ''); const [inputKind, setKind] = useState<'PASTED_TEXT' | 'PASTED_MARKDOWN'>(document?.inputKind === 'PASTED_MARKDOWN' ? 'PASTED_MARKDOWN' : 'PASTED_TEXT');
  const [title, setTitle] = useState(document?.title ?? 'Customer requirements'); const [selected, setSelected] = useState(''); const [error, setError] = useState(''); const [replace, setReplace] = useState(false);
  useEffect(() => { setText(document?.text ?? ''); setTitle(document?.title ?? 'Customer requirements'); setKind(document?.inputKind === 'PASTED_MARKDOWN' ? 'PASTED_MARKDOWN' : 'PASTED_TEXT'); }, [document?.id]);
  const requirements = Object.values(session.requirements).filter(r => r.lifecycle === 'ACTIVE');
  const chosen = session.requirements[selected]; const dirty = text !== document?.text || inputKind !== document?.inputKind || title !== document?.title;
  async function act(path: string, body?: object) { setError(''); try { await mutate(path, body); setReplace(false); } catch (e) { setError(e instanceof Error ? e.message : 'The operation failed.'); } }
  return <>
    <section className="panel"><h3>Customer input</h3><p className="muted">Paste plain text or Markdown. Original text stays immutable after saving. MOCK analysis supports the four recorded seed inputs.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="field-grid"><label>Input title<input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label><label>Input format<select value={inputKind} onChange={e => setKind(e.target.value as typeof inputKind)}><option value="PASTED_TEXT">Plain text</option><option value="PASTED_MARKDOWN">Markdown source</option></select></label></div>
      <label>Customer requirements<textarea rows={7} maxLength={60000} value={text} onChange={e => setText(e.target.value)} /></label>
      <p className="muted">{document ? `${document.id} · Version ${document.version} · ${document.sectionIds.length} source sections` : 'No input saved'}{dirty && ' · Unsaved input'}</p>
      <div className="actions"><button disabled={busy || !text.trim() || !title.trim() || !dirty} onClick={() => void act('input', { text, title, inputKind })}>{document ? 'Save new source version' : 'Save customer input'}</button><button className="primary" disabled={busy || !document || dirty || (requirements.length > 0 && !replace)} onClick={() => void act('analyze')}>Analyze with MOCK</button></div>
      {requirements.length > 0 && <label className="check"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Re-analyze: retire the current scope and create new draft IDs. Previous sources and items remain available.</label>}
    </section>
    <section className="panel" data-testid="scope-status"><div className="row"><h3>Scope review</h3><span className={`chip ${scope?.status === 'APPROVED' ? 'reviewed' : 'draft'}`}>{scope?.status ?? 'Checking scope…'}</span></div><p>{scope?.eligibility.eligible ? 'Current reviewed scope is eligible for later generators.' : 'Review the extracted scope before generating downstream deliverables.'}</p>
      {scope && scope.blockers.length > 0 && <details><summary>{scope.blockers.length} review conditions remaining</summary><ul>{scope.blockers.map(b => <li key={b}>{b}</li>)}</ul></details>}
      {!!scope?.warnings.length && <details open><summary>Uncertainty retained in this scope</summary><ul>{scope.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
      <button disabled={busy || scope?.status !== 'READY_FOR_REVIEW'} onClick={() => void act('approve')}>Approve reviewed scope</button>
    </section>
    <section className="panel"><div className="row"><h3>Structured requirements</h3><span className="muted">{requirements.length} active · {requirements.filter(r => r.review === 'REVIEWED').length} reviewed</span></div>
      {!requirements.length ? <p>Save input and run MOCK analysis to begin reviewing scope.</p> : <div className="table-wrap"><table><thead><tr><th>ID / type</th><th>Description</th><th>Priority</th><th>Origin</th><th>Review</th><th>Inclusion</th></tr></thead><tbody>{requirements.map(r => <tr key={r.id} className={selected === r.id ? 'selected' : ''}><td><button aria-label={`Inspect ${r.id}`} onClick={() => setSelected(r.id)}>{r.id}</button><small>{r.type}</small></td><td>{r.description}</td><td>{r.priority}</td><td><span className={`chip ${r.origin.toLowerCase()}`}>{r.origin}</span></td><td><span className={`chip ${r.review.toLowerCase()}`}>{r.review}</span></td><td>{r.inclusion}</td></tr>)}</tbody></table></div>}
      {Object.values(session.requirements).some(r => r.lifecycle === 'RETIRED') && <details><summary>Retained retired requirements</summary>{Object.values(session.requirements).filter(r => r.lifecycle === 'RETIRED').map(r => <p key={r.id}><button onClick={() => setSelected(r.id)}>{r.id} · RETIRED</button> {r.description}</p>)}</details>}
    </section>
    {chosen && (chosen.lifecycle === 'ACTIVE' ? <RequirementDetail key={`${session.id}-${chosen.id}-${chosen.revision}-${chosen.review}`} requirement={chosen} session={session} mutate={mutate} busy={busy} /> : <section className="panel"><h3>{chosen.id} · RETIRED</h3><p>{chosen.description}</p><p>Retained for history. This item cannot justify new scope.</p>{chosen.evidence.map((a, i) => <pre key={i}>{a.excerpt}</pre>)}</section>)}
    {requirements.length > 0 && <AssumptionsQuestions session={session} mutate={mutate} busy={busy} />}
    {session.context.analysisSectionIds.length > 0 && <section className="panel"><h3>Analysis context</h3>{session.context.analysisSectionIds.map(id => { const section = session.artifactSections[id]; return section?.payload.kind === 'Narrative' && <details key={id}><summary>{section.payload.topic} · {section.origin}</summary>{section.payload.paragraphs.map((p, i) => <p key={i}>{p.text}</p>)}{section.payload.facts?.map((f, i) => <p key={i}><strong>{f.subject}</strong>: {f.value} · {f.requirementIds.join(', ')}</p>)}</details>; })}</section>}
  </>;
}
