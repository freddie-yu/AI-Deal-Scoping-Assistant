import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { ScopingSession } from '../../src/domain/index.js';
import { DISCLAIMER } from '../../src/export/constants.js';
async function click(page: Page,name:string) {
  const button=page.getByRole('button',{name,exact:true}); await expect(button).toBeEnabled({timeout:30000});
  const response=page.waitForResponse(r=>['POST','PATCH'].includes(r.request().method())&&r.url().includes('/api/sessions/'));
  await button.click(); const r=await response; expect(r.ok(),await r.text()).toBe(true);
  await expect(page.getByRole('status')).toContainText('Saved locally');
}
async function accept(page:Page) {
  await expect(page.getByRole('button',{name:/^Accept AS_/}).first()).toBeVisible();
  while(await page.getByRole('button',{name:/^Accept AS_/}).count()){
    const name=await page.getByRole('button',{name:/^Accept AS_/}).first().getAttribute('aria-label');
    await click(page,name!); await expect(page.getByRole('button',{name:name!,exact:true})).toHaveCount(0);
  }
}
async function download(page:Page,request:APIRequestContext,id:string) {
  const panel=page.getByTestId('final-package');
  await expect(panel.getByRole('button',{name:'Download Markdown'})).toBeVisible({timeout:30000});
  if(await panel.getByRole('checkbox').count()){
    await panel.getByRole('checkbox').check(); await click(page,'Acknowledge export warnings');
  }
  await expect(panel.getByRole('button',{name:'Download Markdown'})).toBeEnabled({timeout:30000});
  const preview=await (await request.get('/api/sessions/'+id+'/package')).json();
  const event=page.waitForEvent('download'); await panel.getByRole('button',{name:'Download Markdown'}).click();
  const result=await event; const bytes=await readFile((await result.path())!);
  expect(result.suggestedFilename()).toMatch(/^[a-z0-9-]+\.md$/);
  expect(bytes.toString('utf8')).toBe(preview.markdown); expect(bytes.toString('utf8')).toContain(DISCLAIMER);
  const saved:ScopingSession=await (await request.get('/api/sessions/'+id)).json();
  expect(saved.exportReceipt!.fileHash).toBe(createHash('sha256').update(bytes).digest('hex'));
  await expect(panel.getByTestId('export-receipt')).toContainText(saved.exportReceipt!.fileHash);
  await panel.getByText('Exact Markdown preview / download content',{exact:true}).click();
  await expect(panel.getByTestId('package-source')).toHaveText(preview.markdown);
  return {saved,preview};
}
test('Phase 5 flagship reviewer completes input, acceptance, scale change, quality, preview and verified download',async({page,request})=>{
  test.setTimeout(420000); await page.setViewportSize({width:1280,height:900}); await page.goto('/');
  await expect(page.getByText('MOCK',{exact:true})).toBeVisible();
  await page.getByLabel('Seed scenario').selectOption('modernization'); await click(page,'Start seed session'); await click(page,'Analyze with MOCK');
  const id=await page.evaluate(()=>localStorage.getItem('scoping-session-id'))!;
  const read=async():Promise<ScopingSession>=>(await request.get('/api/sessions/'+id)).json();
  let s=await read();
  for(const r of Object.values(s.requirements)){
    await page.getByRole('button',{name:'Inspect '+r.id,exact:true}).click();
    await expect(page.getByTestId('requirement-detail').getByTestId('source-evidence')).toContainText(r.evidence[0]!.excerpt);
    await click(page,'Review '+r.id);
  }
  for(const a of [...Object.values(s.assumptions),...Object.values(s.questions)])await click(page,'Review '+a.id);
  await click(page,'Approve reviewed scope');
  for(const [area,action] of [['PRD & Scope','Generate PRD and scope'],['Architecture','Generate AWS architecture'],['Data / Integration / AI','Generate data, integration and AI strategy'],['Estimate','Propose delivery workstreams']]){
    await page.getByRole('button',{name:area!,exact:true}).click(); await click(page,action!); await accept(page);
  }
  await click(page,'Prepare estimation proposals'); await page.getByRole('checkbox',{name:/I have reviewed the displayed inventory/}).check();
  await click(page,'Accept reviewed estimation basis'); await click(page,'Calculate estimate');
  await expect(page.getByTestId('estimate-effort')).toContainText('person-days');
  await page.getByRole('button',{name:'Quality / Final Package',exact:true}).click(); await click(page,'Run quality gate');
  await expect(page.getByTestId('quality-gate')).toContainText('REVIEW_REQUIRED');
  await page.getByLabel('Package section').selectOption({label:'20. Traceability'});
  await expect(page.getByTestId('package-preview')).toContainText('FR_01');
  s=await read();const scale=Object.values(s.requirements).find(r=>r.measures?.expectedUsers)!;
  await page.getByRole('button',{name:'Requirements',exact:true}).click();await page.getByRole('button',{name:'Inspect '+scale.id,exact:true}).click();
  await page.getByText('Change expected users',{exact:true}).click();await page.getByLabel('Expected users target').fill('500000');await click(page,'Record scale change');
  await click(page,'Review '+scale.id);s=await read();await click(page,'Review '+s.requirements[scale.id]!.assumptionIds.at(-1)!);await click(page,'Approve reviewed scope');
  await page.getByRole('button',{name:'Review change impact',exact:true}).click();
  await expect(page.getByTestId('impact-affected')).toContainText('STALE');await expect(page.getByTestId('impact-unaffected')).toContainText('REVIEWED');
  let rounds=0;while((await read()).lastImpact!.regenerationTargets.length){expect(rounds++).toBeLessThan(30);await click(page,'Regenerate affected content');await accept(page);}
  await click(page,'Recalculate affected estimate');await click(page,'Run quality gate');
  await page.getByLabel('Package section').selectOption({label:'21. Change-Impact Summary'});await expect(page.getByTestId('package-preview')).toContainText('500000');
  await download(page,request,id!);
  await page.getByLabel('Package section').selectOption({label:'7. Architecture Diagram'});
  await page.getByTestId('final-package').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/phase5-package-desktop.png'});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Package section').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/phase5-package-mobile.png'});
  await expect(page.getByTestId('package-preview')).toContainText('Component inventory');
  await page.getByLabel('Package section').selectOption({label:'22. Quality Findings / Human Validation Items'});
  await page.getByLabel('Package section').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/phase5-findings-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const seed of ['integration-heavy','ai-enabled','missing-information'])test('Phase 5 '+seed+' API journey reaches browser preview and download',async({page,request})=>{
  test.setTimeout(180000);
  let s:ScopingSession=await (await request.post('/api/sessions/seed',{data:{seedId:seed}})).json();
  const post=async(path:string,body:object={})=>{const r=await request.post('/api/sessions/'+s.id+'/'+path,{data:{expectedRevision:s.revision,...body}});expect(r.ok(),await r.text()).toBe(true);s=await r.json();};
  await post('analyze');for(const k of ['requirements','assumptions','questions'] as const)for(const id of Object.keys(s[k]))await post(k+'/'+id+'/review');await post('approve');
  for(const operation of ['prd-scope','architecture','strategies','delivery']){
    await post('generate',{operation});const run=Object.values(s.generationRuns).at(-1)!;
    for(const p of run.proposals)if(p.target.kind==='ArtifactSection')await post('runs/'+run.id+'/sections/'+p.target.id+'/review',{decision:'ACCEPTED'});
  }
  await post('estimate/prepare');await post('estimate/review',{confirmed:true});await post('estimate/calculate');
  await page.goto('/');await page.getByLabel('Session ID',{exact:true}).fill(s.id);await page.getByRole('button',{name:'Load session',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.getByRole('button',{name:'Quality / Final Package',exact:true}).click();await click(page,'Run quality gate');
  const {preview}=await download(page,request,s.id);
  if(seed==='integration-heavy')expect(preview.markdown).toContain('Salesforce');
  if(seed==='ai-enabled')expect(preview.markdown).toContain('human');
  if(seed==='missing-information'){expect(preview.markdown).toContain('Unavailable');expect(preview.gate.status).toBe('REVIEW_REQUIRED');}
});


