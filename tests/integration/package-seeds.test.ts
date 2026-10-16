import { beforeAll, afterAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { estimatedSeed } from '../helpers/package.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { EstimationCommands } from '../../src/application/estimation.js';
import { QualityCommands } from '../../src/application/quality.js';
import { ExportCommands } from '../../src/application/export.js';
import { assertSemanticGoldens } from '../helpers/semantic-goldens.js';
import { assertPhase2Goldens } from '../helpers/phase2-goldens.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { scopeFingerprint } from '../../src/application/scope-review.js';
import { calculateEstimate } from '../../src/estimation/engine.js';
import { setConfig } from '../../src/estimation/config.js';
import { renderPackage } from '../../src/export/index.js';
import type { ScopingSession } from '../../src/domain/index.js';
let dir: string, repo: JsonSessionRepository;
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'package-seeds-')); repo = new JsonSessionRepository(dir); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
async function exportCurrent(s: ScopingSession) {
  s = await new QualityCommands(repo).evaluate(s.id,{expectedRevision:s.revision});
  expect(s.gate!.issues.filter(i=>i.blocking)).toEqual([]);
  const c=new ExportCommands(repo); let p=await c.preview(s.id);
  if (p.gate.status==='REVIEW_REQUIRED') { await c.acknowledge(s.id,{expectedRevision:s.revision,snapshotHash:p.snapshotHash,confirmed:true}); p=await c.preview(s.id); }
  const result=await c.download(s.id,{expectedRevision:s.revision,snapshotHash:p.snapshotHash});
  expect(result.markdown).toBe(p.markdown); return {s:await repo.load(s.id),p:result};
}
async function refresh(s: ScopingSession) {
  const scope=new ScopeCommands(repo), d=new DeliverableCommands(repo);
  for(const kind of ['requirements','assumptions','questions'] as const) for(const x of Object.values(s[kind])) if(x.review!=='REVIEWED') s=await scope.review(s.id,kind,x.id,{expectedRevision:s.revision});
  s=await scope.approve(s.id,{expectedRevision:s.revision});
  let rounds=0;
  while(s.lastImpact?.regenerationTargets.length) {
    expect(rounds++).toBeLessThan(30);
    s=await d.generateAffected(s.id,{expectedRevision:s.revision});
    const run=Object.values(s.generationRuns).at(-1)!;
    for(const p of run.proposals) if(p.target.kind==='ArtifactSection') s=await d.review(s.id,run.id,p.target.id,{expectedRevision:s.revision,decision:'ACCEPTED'});
  }
  return new EstimationCommands(repo).calculate(s.id,{expectedRevision:s.revision});
}
it.each(['modernization','integration-heavy','ai-enabled','missing-information'])('%s completes semantic golden package, important change, selective update and export',async seed=>{
  let s=await estimatedSeed(repo,seed); const original=structuredClone(s), manifest=await loadSeed(seed);
  assertSemanticGoldens(s,manifest); assertPhase2Goldens(s,manifest);
  const initial=await exportCurrent(s); s=initial.s;
  for(const r of Object.values(s.requirements)) expect(initial.p.markdown).toContain(r.id);
  const scope=new ScopeCommands(repo), e=new EstimationCommands(repo);
  if(seed==='modernization'){
    const r=Object.values(s.requirements).find(r=>r.measures?.expectedUsers)!;
    s=await scope.changeExpectedUsers(s.id,r.id,{expectedRevision:s.revision,value:500000,basis:'Reviewed scale planning variant'});
    s=await refresh(s);
  } else if(seed==='integration-heavy'){
    const u=Object.values(s.artifactSections).filter(a=>a.payload.kind==='EstimationUnit'&&a.payload.unitType==='INTEGRATION')[1]!;
    if(u.payload.kind!=='EstimationUnit'||u.payload.drivers.policy!=='THREE_FLAGS') throw Error('Missing integration driver');
    const n=u.payload.drivers.flags[2].inputs[0]!.node;
    if(n.kind!=='CONFIGURATION') throw Error('Missing config');
    const unrelated=Object.values(s.artifactSections).filter(a=>a.payload.kind==='EstimateItem'&&a.payload.unitId!==u.id && Object.values(s.artifactSections).some(x=>x.id===(a.payload.kind==='EstimateItem'?a.payload.unitId:'')&&x.payload.kind==='EstimationUnit'&&x.payload.unitType==='INTEGRATION'));
    s=await e.configure(s.id,{expectedRevision:s.revision,confirmed:true,updates:[{key:n.key,value:true,basis:'INT_B reconciliation required; other interfaces preserved'}]});
    expect(unrelated.map(a=>s.artifactSections[a.id])).toEqual(unrelated);
  } else {
    const asm=Object.values(s.assumptions)[0]!;
    if(seed==='ai-enabled'){
      const r=Object.values(s.requirements).find(r=>r.description==='A support agent must approve every reply before it is sent.')!;
      const description='A support agent and supervisor must approve every reply before it is sent.';
      s=await scope.editAssumption(s.id,asm.id,{expectedRevision:s.revision,patch:{statement:description,basis:'Two-person approval planning requirement',validation:'PROVISIONAL'}});
      s=await scope.editRequirement(s.id,r.id,{expectedRevision:s.revision,patch:{description,origin:'ASSUMED',basis:'Two-person approval planning requirement',assumptionIds:[asm.id]}});
    }else{
      const summary=Object.values(s.artifactSections).find(a=>a.payload.kind==='EstimateSummary')!;
      expect(summary.payload).toMatchObject({commercials:{total:null},confidence:'LOW'});
      const r=Object.values(s.requirements).find(r=>r.measures?.concurrency)!;
      s=await scope.editAssumption(s.id,asm.id,{expectedRevision:s.revision,patch:{statement:'Planning target: 100 concurrent users.',basis:'Reviewed capacity planning target',validation:'PROVISIONAL',value:{kind:'NUMBER',value:100,unit:'concurrent users'}}});
      s=await scope.editRequirement(s.id,r.id,{expectedRevision:s.revision,patch:{origin:'ASSUMED',basis:'Reviewed capacity planning target',measures:{concurrency:{state:'KNOWN',value:{value:100,unit:'concurrent users'}}}}});
    }
    s=await refresh(s);
  }
  const final=await exportCurrent(s);
  expect(final.s.documents).toEqual(original.documents);
  expect(final.s.exportReceipts).toHaveLength(2);
  expect(final.p.sections.find(p=>p.title==='Change-Impact Summary')!.body).not.toContain('No reviewed controlled change');
  expect(final.s.controlledChange!.updatedSectionIds.length).toBeGreaterThan(0);
  expect(Object.values(final.s.artifactSections).filter(a=>a.lifecycle==='ACTIVE'&&a.freshness==='STALE')).toEqual([]);
  if(seed==='modernization') expect(final.p.markdown).toContain('500000');
  if(seed==='integration-heavy') { expect(final.p.markdown).toContain('Salesforce'); expect(final.p.markdown).not.toContain('HubSpot'); }
  if(seed==='ai-enabled') expect(final.p.markdown).toContain('supervisor approval records');
  if(seed==='missing-information') {
    expect(final.p.markdown).toContain('100 concurrent users'); expect(final.p.gate.status).toBe('REVIEW_REQUIRED');
    expect(final.p.markdown).toContain('Unavailable');
    const beforeWarnings=final.p.gate.issues.filter(i=>i.type==='MISSING_ESTIMATE_INPUT').length;
    s=await e.configure(s.id,{expectedRevision:s.revision,confirmed:true,updates:[{key:'rates.E',value:{amount:80000,currency:'USD',unit:'minor-units/person-day'},basis:'Reviewer supplied engineering rate for this planning scenario'}]});
    const supplied=await exportCurrent(s);
    expect(Object.values(s.artifactSections).find(a=>a.payload.kind==='EstimateSummary')!.payload).toMatchObject({commercials:{total:expect.any(Object)},confidence:'LOW'});
    expect(supplied.p.gate.issues.filter(i=>i.type==='MISSING_ESTIMATE_INPUT').length).toBeLessThan(beforeWarnings);
    expect(supplied.p.gate.status).toBe('REVIEW_REQUIRED');
  }
},120000);
it('PASS exports without acknowledgment and preserves receipts against mutation',async()=>{
  let s=await estimatedSeed(repo,'ai-enabled');
  for(const a of Object.values(s.assumptions)){a.validation='CONFIRMED';a.confirmation={note:'Test-only confirmed workshop fixture',evidence:a.sources};}
  for(const q of Object.values(s.questions)){q.status='ANSWERED';q.answer={text:'Test-only supplied input',evidence:[],basis:'Workshop fixture'};}
  s.scopeReviewFingerprint=scopeFingerprint(s);
  setConfig(s,'calibration',{status:'CALIBRATED',evidence:'Test-only calibrated fixture'},'Test-only',true);
  for(const a of Object.values(s.artifactSections))if(a.payload.kind==='EstimationUnit'&&a.payload.unitType==='INTEGRATION')setConfig(s,'readiness.'+a.id,true,'Test-only confirmed interface',true);
  s=calculateEstimate(s,new Date().toISOString()); s.revision++; await repo.save(s,s.revision-1);
  const result=await exportCurrent(s); expect(result.p.gate.status).toBe('PASS');
  expect(result.p.acknowledged).toBe(false);
  const changed=structuredClone(result.s); changed.exportReceipts![0]!.fileHash='tampered';changed.revision++;
  await expect(repo.save(changed,changed.revision-1)).rejects.toThrow(/immutable/i);
  expect(renderPackage(result.s).fileHash).toBe(result.p.receipt.fileHash);
},60000);


it('retains a human unit exclusion through review, recalculation and final export',async()=>{
  let s=await estimatedSeed(repo);const e=new EstimationCommands(repo);
  const unit=Object.values(s.artifactSections).find(a=>a.payload.kind==='EstimationUnit'&&a.payload.unitType==='CLOUD')!;
  s=await e.editUnit(s.id,unit.id,{expectedRevision:s.revision,confirmed:true,inclusion:'EXCLUDED',exclusionReason:'Reviewer deferred this environment'});
  s=await e.review(s.id,{expectedRevision:s.revision,confirmed:true});s=await e.calculate(s.id,{expectedRevision:s.revision});
  const result=await exportCurrent(s);
  expect(result.s.controlledChange?.impact.change?.changes.some(c=>c.node.kind==='ArtifactSection'&&c.node.id===unit.id)).toBe(true);
  expect(result.p.sections[20]!.body).toContain('EXCLUDED');
  expect(result.p.sections[20]!.body).toContain('Reviewer deferred this environment');
},60000);

