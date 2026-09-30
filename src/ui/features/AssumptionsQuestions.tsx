import React, { useState } from 'react';
import type { Assumption, ClarificationQuestion, ScopingSession } from '../../domain/index.js';
import type { Mutate } from '../api.js';
import { SourceEvidence } from './SourceEvidence.js';
type Props = { session: ScopingSession; mutate: Mutate; busy: boolean };
function AssumptionCard({ item: a, session, mutate, busy }: Props & { item: Assumption }) {
  const [edit, setEdit] = useState(false); const [error, setError] = useState('');
  const [statement, setStatement] = useState(a.statement); const [basis, setBasis] = useState(a.basis); const [validation, setValidation] = useState(a.validation); const [note, setNote] = useState(a.confirmation?.note ?? '');
  async function save(path: string, body?: object, method?: 'POST' | 'PATCH') { setError(''); try { await mutate(path, body, method); setEdit(false); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); } }
  return <article className="scope-card"><div className="row"><h4>{a.id}</h4><span className="chip">{a.review}</span></div><span className="chip assumed">ASSUMED</span> <span className="chip">{a.validation}</span><p>{a.statement}</p><p className="muted">{a.basis}</p>
    {a.confirmation && <p>Confirmation: {a.confirmation.note}</p>}{a.value && <p>Typed value: {String(a.value.value)} {'unit' in a.value ? a.value.unit : ''}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {edit ? <form onSubmit={e => { e.preventDefault(); void save(`assumptions/${a.id}`, { patch: { statement, basis, validation, ...(validation === 'CONFIRMED' ? { confirmation: { note, evidence: a.confirmation?.evidence ?? [] } } : {}) } }, 'PATCH'); }}>
      <label>Assumption statement<textarea required value={statement} onChange={e => { setStatement(e.target.value); if (validation === 'CONFIRMED') { setValidation('UNVALIDATED'); setNote(''); } }} /></label><label>Assumption basis<textarea required value={basis} onChange={e => setBasis(e.target.value)} /></label>
      <label>Validation state<select value={validation} onChange={e => setValidation(e.target.value as Assumption['validation'])}>{['UNVALIDATED', 'PROVISIONAL', 'CONFIRMED'].map(v => <option key={v}>{v}</option>)}</select></label>
      {validation === 'CONFIRMED' && <label>Confirmation note<textarea required value={note} onChange={e => setNote(e.target.value)} /></label>}
      <div className="actions"><button disabled={busy}>Save assumption</button><button type="button" onClick={() => setEdit(false)}>Cancel</button></div>
    </form> : <div className="actions"><button disabled={busy} onClick={() => setEdit(true)}>Edit {a.id}</button><button disabled={busy || a.review === 'REVIEWED'} onClick={() => void save(`assumptions/${a.id}/review`)}>Review {a.id}</button></div>}
    <details><summary>Assumption source and context</summary><p>{a.contextRefs.map(r => 'id' in r ? r.id : r.kind).join(', ')}</p><SourceEvidence session={session} anchors={a.sources} /></details>
  </article>;
}
function QuestionCard({ item: q, session, mutate, busy }: Props & { item: ClarificationQuestion }) {
  const [text, setText] = useState(q.answer?.text ?? ''); const [basis, setBasis] = useState(q.answer?.basis ?? ''); const [error, setError] = useState('');
  async function act(path: string, body?: object) { setError(''); try { await mutate(path, body); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); } }
  return <article className="scope-card"><div className="row"><h4>{q.id} · {q.subject}</h4><span className="chip">{q.review}</span></div><p><span className="chip">{q.criticality}</span> <span className="chip">{q.status}</span></p><p>{q.question}</p><p className="muted">{q.basis}</p>
    {q.answer && <p>Recorded answer: {q.answer.text} · {q.answer.basis}</p>}{error && <p role="alert" className="error">{error}</p>}
    <details><summary>Answer or revise answer</summary><form onSubmit={e => { e.preventDefault(); void act(`questions/${q.id}/answer`, { answer: { text, basis, evidence: [] } }); }}><label>Answer<textarea required value={text} onChange={e => setText(e.target.value)} /></label><label>Answer basis<input required value={basis} onChange={e => setBasis(e.target.value)} /></label><p className="muted">Saving an answer does not change requirements or assumptions. Apply any scope change explicitly.</p><button disabled={busy}>Save answer</button></form></details>
    <button disabled={busy || q.review === 'REVIEWED'} onClick={() => void act(`questions/${q.id}/review`)}>Review {q.id}</button>
    <details><summary>Question context</summary><p>{q.related.map(r => 'id' in r ? r.id : r.kind).join(', ')}</p><SourceEvidence session={session} anchors={q.sources ?? []} /></details>
  </article>;
}
export function AssumptionsQuestions(props: Props) { return <div className="field-grid"><section className="panel"><h3>Assumptions</h3><p className="muted">Review accepts use for planning. PROVISIONAL remains uncertain; CONFIRMED requires a confirmation note.</p>{Object.values(props.session.assumptions).filter(a => a.lifecycle === 'ACTIVE').map(a => <AssumptionCard key={`${a.id}-${a.revision}-${a.review}`} {...props} item={a} />)}</section><section className="panel"><h3>Missing information &amp; questions</h3><p className="muted">Open questions can be reviewed as unresolved. Critical gaps remain visible after approval.</p>{Object.values(props.session.questions).filter(q => q.lifecycle === 'ACTIVE').map(q => <QuestionCard key={`${q.id}-${q.revision}-${q.review}`} {...props} item={q} />)}</section></div>; }
