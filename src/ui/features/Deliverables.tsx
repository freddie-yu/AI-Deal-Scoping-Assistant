import React, { useEffect, useState } from 'react';
import type { ArtifactSection, ScopingSession } from '../../domain/index.js';
import type { Phase2Operation } from '../../domain/deliverables.js';
import { api, type Mutate, type ScopeStatus } from '../api.js';
import { ArtifactReview } from './ArtifactReview.js';
import { ArchitectureDiagram } from './ArchitectureDiagram.js';
import { technologyChecks } from '../../validation/deliverables.js';
import type { scopeCoverage } from '../../traceability/coverage.js';
const operations = { 'PRD & Scope': 'prd-scope', Architecture: 'architecture', 'Data / Integration / AI': 'strategies', Estimate: 'delivery' } as const;
const labels: Record<Phase2Operation, string> = { 'prd-scope': 'Generate PRD and scope', architecture: 'Generate AWS architecture', strategies: 'Generate data, integration and AI strategy', delivery: 'Propose delivery workstreams' };
const kinds: Record<Phase2Operation, string[]> = { 'prd-scope': ['PRD', 'FUNCTIONAL_SCOPE'], architecture: ['ARCHITECTURE'], strategies: ['DATA_STRATEGY', 'INTEGRATION_STRATEGY', 'AI_STRATEGY'], delivery: ['DELIVERY_PLAN'] };
export function Deliverables({ area, session, mutate, busy, scope }: { area: keyof typeof operations; session: ScopingSession; mutate: Mutate; busy: boolean; scope: ScopeStatus | null }) {
  const operation = operations[area]; const [error, setError] = useState(''); const [view, setView] = useState<'proposals' | 'accepted'>('proposals');
  const [coverage, setCoverage] = useState<ReturnType<typeof scopeCoverage> | null>(null);
  const [ineligible, setIneligible] = useState<string[]>([]);
  useEffect(() => { let current = true; void api(`/api/sessions/${session.id}/artifacts`).then(v => { if (current) { const result = v as { coverage: ReturnType<typeof scopeCoverage>; ineligibleSectionIds: string[] }; setCoverage(result.coverage); setIneligible(result.ineligibleSectionIds); } }).catch(() => { if (current) setError('Artifact eligibility and coverage could not be loaded.'); }); return () => { current = false; }; }, [session]);
  const runs = Object.values(session.generationRuns).filter(r => r.operation === operation && r.schemaVersion === '2'); const run = runs.at(-1);
  const proposals = run?.proposals.flatMap(p => p.action !== 'RETIRE' && p.candidate.kind === 'ArtifactSection' && !run.decisions?.[p.candidate.record.id] ? [p.candidate.record] : []) ?? [];
  const accepted = Object.values(session.artifactSections).filter(a => kinds[operation].includes(session.artifacts[a.artifactId]?.kind ?? ''));
  const sections = view === 'proposals' ? proposals : accepted;
  const compatible = technologyChecks(session, sections);
  const stale = run && (run.acceptanceRevision ?? run.baseSessionRevision) !== session.revision;
  async function act(path: string, body: object) { setError(''); try { await mutate(path, body); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); } }
  const diagramSections: ArtifactSection[] = Object.values({ ...Object.fromEntries(accepted.map(a => [a.id, a])), ...Object.fromEntries(sections.map(a => [a.id, a])) });
  return <>
    <section className="panel"><div className="row"><h3>{scope?.eligibility.eligible ? 'Scope eligible' : 'Scope review required'}</h3><span className="chip">MOCK proposals · human acceptance required</span></div>
      <p>{operation === 'architecture' ? 'Supported in this submission: AWS. Inspect service rationale, trade-offs, security and source grounding.' : operation === 'delivery' ? 'Review phases, dependencies, suggested skills and advisory complexity. After accepting workstreams, prepare and review the deterministic estimation basis above.' : 'Generate connected proposals from the approved scope, inspect their evidence, then accept or reject each section.'}</p>
      {!scope?.eligibility.eligible && <p className="muted">Approve the current reviewed scope in Requirements before generation or acceptance.</p>}
      <button className="primary" disabled={busy || !scope?.eligibility.eligible} onClick={() => { setView('proposals'); void act('generate', { operation }); }}>{labels[operation]}</button>
    </section>
    {error && <p role="alert" className="error">{error}</p>}{run?.error && <p className="error">{run.error.message}</p>}
    {operation === 'prd-scope' && coverage && <section className="panel" data-testid="scope-coverage"><h3>Requirement-to-capability coverage</h3><p><strong>{coverage.percentage === null ? 'N/A' : `${Math.round(coverage.percentage)}%`}</strong> · {coverage.covered}/{coverage.eligible} reviewed included requirements covered by accepted capabilities.</p><p>Uncovered: {coverage.uncoveredIds.join(', ') || 'None'}</p><p>Excluded: {coverage.excluded.map(r => `${r.id}: ${r.reason}`).join('; ') || 'None'}</p><p>High priority: {coverage.highPriority.covered}/{coverage.highPriority.eligible}</p><details><summary>Inspect requirement mapping</summary>{coverage.rows.map(r => <p key={r.id}>{r.id} · {r.type} → {r.capabilityIds.join(', ') || 'Uncovered'}</p>)}</details></section>}
    <div className="actions"><button aria-pressed={view === 'proposals'} onClick={() => setView('proposals')}>Proposals ({proposals.length})</button><button aria-pressed={view === 'accepted'} onClick={() => setView('accepted')}>Accepted ({accepted.length})</button></div>
    {stale && view === 'proposals' && <p className="error">This proposal belongs to an earlier session revision. Generate a fresh proposal before acceptance.</p>}
    {!sections.length && <p className="muted">No {view} for this workspace yet.</p>}
    {operation === 'architecture' && diagramSections.some(a => a.payload.kind === 'ArchitectureComponent') && <ArchitectureDiagram sections={diagramSections} />}
    {compatible.some(c => c.status !== 'COMPATIBLE') && <details><summary>Technology compatibility requires review</summary>{compatible.filter(c => c.status !== 'COMPATIBLE').map((c, i) => <p key={i}>{c.status} · {c.sourceId} → {c.sectionId ?? 'No choice'}: {c.reason}</p>)}</details>}
    <div className="artifact-grid">{sections.map(a => <ArtifactReview key={a.id} section={a} session={session} pending={view === 'proposals'} busy={busy || !!stale || !scope?.eligibility.eligible} warnings={[...compatible.filter(c => c.sectionId === a.id && c.status !== 'COMPATIBLE').map(c => `${c.status}: ${c.reason}`), ...(view === 'accepted' && ineligible.includes(a.id) ? ['Input eligibility changed. Historical accepted content is retained; generate and review a fresh proposal before downstream use.'] : [])]} accept={() => void act(`runs/${run!.id}/sections/${a.id}/review`, { decision: 'ACCEPTED' })} reject={() => void act(`runs/${run!.id}/sections/${a.id}/review`, { decision: 'REJECTED' })} />)}</div>
  </>;
}
