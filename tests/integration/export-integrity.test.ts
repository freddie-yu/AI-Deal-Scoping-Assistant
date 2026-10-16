import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { estimatedSeed } from '../helpers/package.js';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { evaluateQuality } from '../../src/quality/index.js';
import { renderPackage, DISCLAIMER_VERSION, TEMPLATE_VERSION } from '../../src/export/index.js';
import { QualityCommands } from '../../src/application/quality.js';
import { ExportCommands } from '../../src/application/export.js';
import { DeliverableCommands } from '../../src/application/deliverables.js';
import { money, escapeText } from '../../src/export/text.js';
import type { ScopingSession } from '../../src/domain/index.js';
let dir:string,repo:JsonSessionRepository,s:ScopingSession;
beforeAll(async()=>{dir=await mkdtemp(join(tmpdir(),'export-integrity-'));repo=new JsonSessionRepository(dir);s=await estimatedSeed(repo,'integration-heavy');s=await new QualityCommands(repo).evaluate(s.id,{expectedRevision:s.revision});},60000);
afterAll(async()=>{await rm(dir,{recursive:true,force:true});});
it('binds every accepted section revision, ruleset, gate, template and disclaimer',()=>{
  const p=renderPackage(s);
  expect(p.basis).toMatchObject({revision:s.revision,gateId:s.gate!.id,gateRuleVersion:s.gate!.ruleVersion,templateVersion:TEMPLATE_VERSION,disclaimerVersion:DISCLAIMER_VERSION,estimationRuleSet:{version:'demo-rom-v1'}});
  for(const r of p.basis.sectionRevisions)expect(s.artifactSections[r.id]!.revision).toBe(r.revision);
}, 30000);
it('uses current commercial ledger, currency, contingency and presentation values',()=>{
  const p=renderPackage(s),a=Object.values(s.artifactSections).find(a=>a.payload.kind==='EstimateSummary')!;
  if(a.payload.kind!=='EstimateSummary')throw Error('No summary');
  const summary=a.payload,body=p.sections[13]!.body;
  expect(body).toContain(money(summary.commercials.total,summary.commercials.currency,summary.commercials.minorUnitDigits));
  expect(body).toContain('Contingency percent | 15');
  expect(p.sections[12]!.body).toContain(summary.presentation!.personWeeks!.low+'–'+summary.presentation!.personWeeks!.high+' person-weeks');
}, 30000);
it('matches coverage denominator, all services and unresolved assumptions in rendered sections',()=>{
  const p=renderPackage(s);
  expect(p.sections[18]!.body).toContain('Eligible reviewed included requirements: '+s.gate!.coverage.eligibleRequirementIds.length);
  for(const a of Object.values(s.artifactSections))if(a.payload.kind==='ArchitectureComponent')expect(p.markdown).toContain(a.payload.catalogServiceKey);
  for(const a of Object.values(s.assumptions))expect(p.sections[14]!.body).toContain(escapeText(a.statement));
}, 30000);
it('does not promote an excluded capability into included traceability',()=>{
  const state=structuredClone(s),cap=Object.values(state.artifactSections).find(a=>a.payload.kind==='Capability')!;
  if(cap.payload.kind!=='Capability')throw Error('No capability');
  cap.payload.inclusion='EXCLUDED';cap.payload.exclusionReason='Customer deferred this capability';cap.payload.classification='OUT_OF_SCOPE';state.gate=evaluateQuality(state);
  const p=renderPackage(state);
  expect(p.sections[4]!.body).toContain('EXCLUDED');
  const requirementId=cap.payload.requirementIds[0];
  const row=p.sections[19]!.body.split('\n').find(r=>r.startsWith('| '+requirementId+' |'))!;
  expect(row.split('|')[4]).not.toContain(cap.id);
}, 30000);
it('reordering canonical maps preserves exact Markdown and hash',()=>{
  const state=structuredClone(s);
  state.artifactSections=Object.fromEntries(Object.entries(state.artifactSections).reverse());
  state.requirements=Object.fromEntries(Object.entries(state.requirements).reverse());
  state.configuration.entries=Object.fromEntries(Object.entries(state.configuration.entries).reverse());
  expect(renderPackage(state).markdown).toBe(renderPackage(s).markdown);
  expect(renderPackage(state).fileHash).toBe(renderPackage(s).fileHash);
}, 30000);
it.each(['<img src=x onerror=alert(1)>','![track](https://example.test/pixel)','[click](javascript:alert(1))','```\n<script>bad()</script>','row|new\n## forged','&lt;script&gt;'])('escapes hostile customer text: %s',value=>{
  const state=structuredClone(s);state.context.opportunityName=value;
  const p=renderPackage(state);
  expect(p.markdown).toContain(escapeText(value));
  expect(p.markdown).not.toContain('<script>');expect(p.markdown).not.toContain('<img');
}, 30000);
it('rejects missing gates and stale quality rule versions',async()=>{
  const c=new ExportCommands(repo);
  await repo.operational(s.id,s.revision,x=>{x.gate!.ruleVersion='obsolete';});
  await expect(c.preview(s.id)).rejects.toThrow();
  await repo.operational(s.id,s.revision,x=>{delete x.gate;});
  await expect(c.preview(s.id)).rejects.toThrow();
  s=await new QualityCommands(repo).evaluate(s.id,{expectedRevision:s.revision});
}, 30000);
it('rejects a forged acknowledged hash and unapproved same-revision operational findings',async()=>{
  const c=new ExportCommands(repo);
  await repo.operational(s.id,s.revision,x=>{x.gate!.acknowledgment={revision:s.revision,findingsHash:'wrong',timestamp:new Date().toISOString()};});
  let p=await c.preview(s.id);expect(p.exportReady).toBe(false);
  await expect(c.download(s.id,{expectedRevision:s.revision,snapshotHash:p.snapshotHash})).rejects.toThrow(/acknowledg/i);
  await c.acknowledge(s.id,{expectedRevision:s.revision,snapshotHash:p.snapshotHash,confirmed:true});p=await c.preview(s.id);
  const generated=await new DeliverableCommands(repo).generate(s.id,{expectedRevision:s.revision,operation:'architecture'});
  expect(generated.revision).toBe(s.revision);expect(generated.gate).toBeUndefined();
  await expect(c.download(s.id,{expectedRevision:s.revision,snapshotHash:p.snapshotHash})).rejects.toThrow();
}, 30000);
it('rejects client-selected filesystem paths or false acknowledgment',async()=>{
  const c=new ExportCommands(repo);
  await expect(c.download(s.id,{expectedRevision:s.revision,snapshotHash:'a'.repeat(64),filename:'../../escape.md'})).rejects.toThrow();
  await expect(c.acknowledge(s.id,{expectedRevision:s.revision,snapshotHash:'a'.repeat(64),confirmed:false})).rejects.toThrow();
}, 30000);


it('retains every current numerical section and complete unit-to-workstream trace in the package',()=>{
  const p=renderPackage(s);
  const numbers=Object.values(s.artifactSections).filter(a=>['EstimationUnit','EstimateItem','EstimateSummary'].includes(a.payload.kind)&&a.lifecycle==='ACTIVE'&&a.freshness==='CURRENT');
  for(const a of numbers)expect(p.basis.sectionRevisions.map(r=>r.id)).toContain(a.id);
  const unit=numbers.find(a=>a.payload.kind==='EstimationUnit'&&a.payload.unitType==='INTEGRATION')!;
  if(unit.payload.kind!=='EstimationUnit')throw Error('No unit');
  expect(p.sections[11]!.body).toContain(unit.id);
  expect(p.sections[19]!.body).toContain(unit.id);expect(p.sections[19]!.body).toContain(unit.payload.workstreamId);
  expect(p.sections[12]!.body).toContain('Calculation steps');
  expect(p.sections[13]!.body).toContain(numbers.find(a=>a.payload.kind==='EstimateItem')!.id);
}, 30000);



