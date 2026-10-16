import React, { useEffect, useState } from 'react';
import type { ScopingSession } from '../../domain/index.js';
import type { renderPackage } from '../../export/markdown.js';
import { DISCLAIMER } from '../../export/constants.js';
import { api, type Mutate } from '../api.js';
import { MarkdownPreview } from './MarkdownPreview.js';
type Preview = ReturnType<typeof renderPackage>;
export function FinalPackage({ session: s, mutate, busy }: { session: ScopingSession; mutate: Mutate; busy: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState(''), [working, setWorking] = useState(false), [confirmed, setConfirmed] = useState(false), [selected, setSelected] = useState(0);
  const [receipt, setReceipt] = useState<{ id: string; fileHash: string } | null>(null);
  useEffect(() => {
    let active = true; setPreview(null); setConfirmed(false); setError(''); setReceipt(s.exportReceipt ?? null);
    if (s.gate?.evaluatedRevision === s.revision) void api('/api/sessions/' + s.id + '/package').then(p => { if (active) setPreview(p as Preview); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Preview unavailable. Run quality again.'); });
    return () => { active = false; };
  }, [s.id,s.revision,s.operationalRevision]);
  async function acknowledge() {
    if (!preview || !confirmed) return; setError('');
    try { await mutate('package/acknowledge', { snapshotHash: preview.snapshotHash, confirmed: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Acknowledgment failed.'); }
  }
  async function download() {
    if (!preview) return; setWorking(true); setError('');
    try {
      const response = await fetch('/api/sessions/' + s.id + '/package/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: s.revision, snapshotHash: preview.snapshotHash }) });
      if (!response.ok) { const problem = await response.json(); throw new Error(problem.error?.message ?? 'Export failed.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = preview.filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReceipt({ id: response.headers.get('X-Export-Receipt-Id')!, fileHash: response.headers.get('X-Content-SHA256')! });
    } catch (e) { setError(e instanceof Error ? e.message : 'Download failed.'); }
    finally { setWorking(false); }
  }
  const disabled = busy || working;
  return <section className="panel final-package" data-testid="final-package">
    <div className="row"><h3>Final package / export: Phase 5</h3><span className="chip">{preview?.gate.status ?? 'Run quality first'}</span></div>
    <p>One current structured snapshot, 23 sections, deterministic Markdown. Preview and download use the same content. Editing the session requires a fresh gate and warning acknowledgment.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!s.gate && <p>Next: run the quality gate above, then review this package.</p>}
    {preview && <>
      <p data-testid="export-readiness">{preview.exportReady ? 'Ready to export' : preview.gate.status === 'BLOCKED' ? 'Export blocked — repair the errors below.' : 'Review unresolved warnings and acknowledge before export.'} · revision {preview.basis.revision}</p>
      {preview.gate.status !== 'PASS' && <details open={preview.gate.status === 'BLOCKED'}><summary>Unresolved quality findings ({preview.gate.issues.length})</summary>{preview.gate.issues.map(x => <p key={x.key}><strong>{x.severity}</strong>: {x.message}</p>)}</details>}
      {preview.gate.status === 'REVIEW_REQUIRED' && !preview.acknowledged && <div className="export-ack"><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I acknowledge the current unresolved warnings and required human validation.</label><button disabled={disabled || !confirmed} onClick={() => void acknowledge()}>Acknowledge export warnings</button></div>}
      {preview.acknowledged && <p>Warnings acknowledged for this revision and findings. They remain visible in the package.</p>}
      <button className="primary" disabled={disabled || !preview.exportReady} onClick={() => void download()}>{working ? 'Preparing download…' : 'Download Markdown'}</button>
      <label className="package-section-select">Package section<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{preview.sections.map((p,i) => <option value={i} key={p.key}>{i+1}. {p.title}</option>)}</select></label>
      <article className="package-preview" data-testid="package-preview"><h3>{preview.sections[selected]!.title}</h3><MarkdownPreview markdown={preview.sections[selected]!.body} /></article>
      <details><summary>Exact Markdown preview / download content</summary><pre className="package-source" data-testid="package-source">{preview.markdown}</pre></details>
      <p className="muted">Snapshot SHA-256: <code>{preview.snapshotHash}</code></p>
    </>}
    <aside className="disclaimer"><strong>Required planning disclaimer</strong><p>{DISCLAIMER}</p></aside>
    {receipt && <details open data-testid="export-receipt"><summary>Export receipt</summary><p>{receipt.id}</p><p>Downloaded content SHA-256: <code>{receipt.fileHash}</code></p><p>Receipt evidence is persisted locally. It identifies the exported revision; subsequent edits require a new export.</p></details>}
  </section>;
}

