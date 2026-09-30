import { Deliverables } from './features/Deliverables.js';
import { Estimate } from './features/Estimate.js';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScopingSessionSchema, type ScopingSession } from '../domain/index.js';
import './styles.css';
import { api, type ScopeStatus } from './api.js';
import { Requirements } from './features/Requirements.js';
import { Quality } from './features/Quality.js';
const areas = ['Requirements', 'PRD & Scope', 'Architecture', 'Data / Integration / AI', 'Estimate', 'Quality / Final Package'] as const;
function App() {
  const [area, setArea] = useState<(typeof areas)[number]>('Requirements');
  const [session, setSession] = useState<ScopingSession | null>(null);
  const [customer, setCustomer] = useState(''); const [opportunity, setOpportunity] = useState('');
  const [loadId, setLoadId] = useState(''); const [busy, setBusy] = useState(false);
  const [server, setServer] = useState('Checking server…'); const [status, setStatus] = useState('No session loaded'); const [error, setError] = useState('');
  const [seeds, setSeeds] = useState<{ id: string; title: string }[]>([]); const [seed, setSeed] = useState('modernization'); const [scope, setScope] = useState<ScopeStatus | null>(null);
  useEffect(() => { void api('/api/seeds').then(value => setSeeds(value as typeof seeds)).catch(() => setError('Seed list unavailable. Check the local server.')); }, []);
  useEffect(() => { setScope(null); let current = true; if (session) void api(`/api/sessions/${session.id}/scope`).then(value => { if (current) setScope(value as ScopeStatus); }).catch(() => { if (current) setError('Scope status could not be loaded.'); }); return () => { current = false; }; }, [session]);
  async function mutate(path: string, body: object = {}, method: 'POST' | 'PATCH' = 'POST') {
    if (!session) return;
    setBusy(true); setError(''); setStatus('Saving…');
    try { const next = ScopingSessionSchema.parse(await api(`/api/sessions/${session.id}/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: session.revision, ...body }) })); setSession(next); setStatus('Saved locally'); }
    catch (e) { setStatus('Not saved · current draft retained'); throw e; }
    finally { setBusy(false); }
  }
  async function startSeed() {
    setBusy(true); setError(''); setStatus('Saving…');
    try { const created = ScopingSessionSchema.parse(await api('/api/sessions/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seedId: seed }) })); setSession(created); setLoadId(created.id); localStorage.setItem('scoping-session-id', created.id); setStatus('Saved locally'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to start seed.'); setStatus('Not saved'); }
    finally { setBusy(false); }
  }
  async function load(id: string) {
    setBusy(true); setError(''); setStatus('Loading…');
    try { const loaded = ScopingSessionSchema.parse(await api(`/api/sessions/${encodeURIComponent(id)}`)); setSession(loaded); setLoadId(id); setStatus('Saved locally'); localStorage.setItem('scoping-session-id', id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load session.'); setStatus('Load failed'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    void api('/api/health').then(() => setServer('Server online')).catch(() => setServer('Server unavailable'));
    const id = localStorage.getItem('scoping-session-id'); if (id) void load(id);
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('Saving…');
    try { const created = ScopingSessionSchema.parse(await api('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: customer, opportunityName: opportunity }) })); setSession(created); setLoadId(created.id); localStorage.setItem('scoping-session-id', created.id); setStatus('Saved locally'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to create session.'); setStatus('Not saved'); }
    finally { setBusy(false); }
  }
  return <div className="app">
    <header><div><p className="eyebrow">PHASE 4 · CONTROLLED CHANGE &amp; QUALITY</p><h1>AI Deal Scoping Assistant</h1></div><span className="badge">MOCK</span></header>
    <div className="context"><strong>{session?.context.opportunityName ?? 'Understand the customer need'}</strong><span role="status">{server} · {status}</span></div>
    <div className="workspace"><nav aria-label="Workspace areas">{areas.map((name, i) => <button key={name} aria-current={area === name ? 'page' : undefined} onClick={() => setArea(name)}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
    <main><p className="eyebrow">WORKSPACE</p><h2>{area}</h2>{error && <p role="alert" className="error">{error}</p>}
    {area === 'Requirements' ? <>
      <p>Build a traceable scope from customer input. Review the evidence, keep uncertainty visible, then approve the current scope.</p>
      <section className="panel seed-panel"><div><label>Seed scenario<select value={seed} onChange={e => setSeed(e.target.value)}>{seeds.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><p className="muted">Each seed starts a new session. Existing sessions stay saved.</p></div><button disabled={busy || !seeds.length} onClick={() => void startSeed()}>Start seed session</button></section>
      <div className="forms"><form onSubmit={create}><h3>New session</h3><label>Customer name<input required maxLength={200} value={customer} onChange={e => setCustomer(e.target.value)} /></label><label>Opportunity name<input required maxLength={200} value={opportunity} onChange={e => setOpportunity(e.target.value)} /></label><button className="primary" disabled={busy}>Create session</button></form>
      <form onSubmit={e => { e.preventDefault(); void load(loadId); }}><h3>Load local session</h3><label>Session ID<input required value={loadId} onChange={e => setLoadId(e.target.value)} /></label><button disabled={busy}>Load session</button><p className="muted">The last loaded session opens again when you return.</p></form></div>
      {session && <><Requirements key={session.id} session={session} mutate={mutate} busy={busy} scope={scope} /><details className="metadata"><summary>Session metadata</summary><dl><dt>Customer</dt><dd>{session.context.customerName}</dd><dt>Opportunity</dt><dd>{session.context.opportunityName}</dd><dt>Session ID</dt><dd>{session.id}</dd><dt>Revision / schema</dt><dd>{session.revision} / {session.schemaVersion}</dd></dl></details></>}
    </> : session && area === 'Quality / Final Package' ? <Quality session={session} mutate={mutate} busy={busy} scope={scope} /> : session && area !== 'Quality / Final Package' ? <>{area === 'Estimate' && <Estimate session={session} mutate={mutate} busy={busy} scope={scope} />}<Deliverables key={area} area={area} session={session} mutate={mutate} busy={busy} scope={scope} /></> : <section className="placeholder"><h3>Start a session</h3><p>Load a seed or local session to review connected deliverables.</p></section>}
    {session?.lastImpact && area !== 'Quality / Final Package' && <section className="panel"><p>Change impact is available for revision {session.lastImpact.evaluatedRevision}. Unaffected reviewed content is preserved.</p><button onClick={() => setArea('Quality / Final Package')}>Review change impact</button></section>}
    <footer><strong>Next action</strong><p>{!session ? 'Start a seed, create a session, or load an existing session ID.' : scope?.eligibility.eligible ? 'Generate PRD and scope, accept proposals, then review architecture and strategy.' : 'Save customer input, analyze, and review each requirement, assumption and question.'}</p></footer>
    </main></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
