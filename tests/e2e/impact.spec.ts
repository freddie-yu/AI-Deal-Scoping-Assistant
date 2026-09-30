import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { ScopingSession } from '../../src/domain/index.js';

async function estimatedSeed(request: APIRequestContext, seedId = 'modernization') {
  let s: ScopingSession = await (await request.post('/api/sessions/seed', { data: { seedId } })).json();
  const post = async (path: string, body: object = {}) => {
    const response = await request.post(`/api/sessions/${s.id}/${path}`, { data: { expectedRevision: s.revision, ...body } });
    expect(response.ok(), await response.text()).toBe(true); s = await response.json();
  };
  await post('analyze');
  for (const kind of ['requirements', 'assumptions', 'questions'] as const) for (const id of Object.keys(s[kind])) await post(`${kind}/${id}/review`);
  await post('approve');
  for (const operation of ['prd-scope', 'architecture', 'strategies', 'delivery']) {
    await post('generate', { operation }); const run = Object.values(s.generationRuns).at(-1)!;
    for (const p of run.proposals) if ('id' in p.target) await post(`runs/${run.id}/sections/${p.target.id}/review`, { decision: 'ACCEPTED' });
  }
  await post('estimate/prepare'); await post('estimate/review', { confirmed: true }); await post('estimate/calculate');
  return s;
}
async function load(page: Page, id: string) {
  await page.goto('/'); await page.getByLabel('Session ID', { exact: true }).fill(id); await page.getByRole('button', { name: 'Load session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved locally');
}
async function clickMutation(page: Page, name: string | RegExp) {
  await expect(page.getByRole('button', { name, exact: typeof name === 'string' })).toBeEnabled({ timeout: 20000 });
  const response = page.waitForResponse(r => ['POST', 'PATCH'].includes(r.request().method()) && r.url().includes('/api/sessions/'));
  await page.getByRole('button', { name, exact: typeof name === 'string' }).click();
  const result = await response; expect(result.ok(), await result.text()).toBe(true);
  await expect(page.getByRole('status')).toContainText('Saved locally');
}

test('Phase 4 flagship scale change reviews bounded proposals and preserves unrelated accepted content', async ({ page, request }) => {
  test.setTimeout(300000);
  const before = await estimatedSeed(request), id = before.id;
  const preserved = Object.values(before.artifactSections).filter(a => ['PRD:prd-personas', 'FUNCTIONAL_SCOPE:cap-fr-01'].includes(a.sectionKey));
  const scale = Object.values(before.requirements).find(r => r.measures?.expectedUsers)!;
  const read = async (): Promise<ScopingSession> => (await request.get(`/api/sessions/${id}`)).json();
  await load(page, id); await page.getByRole('button', { name: 'Quality / Final Package', exact: true }).click();
  await clickMutation(page, 'Run quality gate'); await expect(page.getByTestId('quality-gate')).toContainText('REVIEW_REQUIRED');
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByRole('button', { name: `Inspect ${scale.id}`, exact: true }).click();
  await page.getByText('Change expected users', { exact: true }).click(); await page.getByLabel('Expected users target').fill('500000');
  await clickMutation(page, 'Record scale change'); await expect(page.getByTestId('requirement-detail')).toContainText('DRAFT');
  await clickMutation(page, `Review ${scale.id}`);
  const edited = await read(); const assumptionId = edited.requirements[scale.id]!.assumptionIds.at(-1)!;
  await clickMutation(page, `Review ${assumptionId}`); await clickMutation(page, 'Approve reviewed scope');
  await page.getByRole('button', { name: 'Review change impact', exact: true }).click();
  await expect(page.getByTestId('quality-gate')).toContainText('NOT EVALUATED');
  await expect(page.getByTestId('change-impact')).toContainText('500000');
  await expect(page.getByTestId('impact-affected')).toContainText('STALE');
  for (const a of preserved) await expect(page.getByTestId('impact-unaffected')).toContainText(a.id);
  await page.getByTestId('impact-affected').getByText('Why is this affected?', { exact: true }).first().click();
  await page.getByTestId('change-impact').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/phase4-impact-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phase4-impact-mobile.png' }); await page.setViewportSize({ width: 1280, height: 900 });
  let rounds = 0;
  while ((await read()).lastImpact!.regenerationTargets.length) {
    expect(rounds++).toBeLessThan(30);
    await clickMutation(page, 'Regenerate affected content');
    const proposals = page.getByTestId('selective-proposals');
    await expect(proposals.getByText('Proposed replacement', { exact: true }).first()).toBeVisible();
    if (rounds === 1) {
      await proposals.getByText('Previous accepted content', { exact: true }).first().click();
      await expect(proposals).toContainText('STALE'); await expect(proposals).toContainText('Grounding');
    }
    while (await proposals.getByRole('button', { name: /^Accept AS_/ }).count()) {
      const name = await proposals.getByRole('button', { name: /^Accept AS_/ }).first().getAttribute('aria-label');
      await clickMutation(page, name!); await expect(proposals.getByRole('button', { name: name!, exact: true })).toHaveCount(0);
    }
  }
  await clickMutation(page, 'Recalculate affected estimate'); await clickMutation(page, 'Run quality gate');
  await expect(page.getByTestId('quality-gate')).toContainText('REVIEW_REQUIRED');
  await expect(page.getByRole('heading', { name: 'Final package / export: Phase 5' })).toBeVisible();
  const after = await read();
  expect(preserved.map(a => after.artifactSections[a.id])).toEqual(preserved); expect(after.documents).toEqual(before.documents);
  expect(Object.values(after.artifactSections).filter(a => a.freshness === 'STALE')).toEqual([]);
  expect(after.gate?.evaluatedRevision).toBe(after.revision); expect(after.gate?.issues.filter(i => i.blocking)).toEqual([]);
  await page.getByTestId('quality-gate').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/phase4-quality-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phase4-quality-mobile.png' });
});

test('Phase 4 rate-only impact preserves architecture and physical effort while updating ROM', async ({ page, request }) => {
  test.setTimeout(180000); const before = await estimatedSeed(request, 'integration-heavy');
  const architecture = Object.values(before.artifactSections).filter(a => a.payload.kind === 'ArchitectureComponent');
  await load(page, before.id); await page.getByRole('button', { name: 'Quality / Final Package', exact: true }).click(); await clickMutation(page, 'Run quality gate');
  await page.getByRole('button', { name: 'Estimate', exact: true }).click();
  const effort = await page.getByTestId('estimate-effort').innerText(), rom = await page.getByTestId('estimate-rom').innerText();
  await page.getByLabel('Rate E minor units per day').fill('95000'); await clickMutation(page, 'Save rate E');
  await expect(page.getByTestId('estimate-effort')).toHaveText(effort); await expect(page.getByTestId('estimate-rom')).not.toHaveText(rom);
  await page.getByRole('button', { name: 'Review change impact', exact: true }).click();
  await expect(page.getByTestId('quality-gate')).toContainText('NOT EVALUATED');
  await expect(page.getByTestId('change-impact')).toContainText('rates.E');
  for (const a of architecture) {
    await expect(page.getByTestId('impact-affected')).not.toContainText(`${a.id} ·`);
    await expect(page.getByTestId('impact-unaffected')).toContainText(`${a.id} ·`);
  }
  const after: ScopingSession = await (await request.get(`/api/sessions/${before.id}`)).json();
  expect(architecture.map(a => after.artifactSections[a.id])).toEqual(architecture);
  expect(after.lastImpact!.affectedSlices.every(s => !s.affected.includes('effort'))).toBe(true);
  await clickMutation(page, 'Run quality gate'); await expect(page.getByTestId('quality-gate')).toContainText('REVIEW_REQUIRED');
});

test('Phase 4 records a browser diagram rendering failure as a blocking gate finding', async ({ page, request }) => {
  test.setTimeout(180000); const s = await estimatedSeed(request);
  await page.route('**/assets/mermaid.core-*.js', route => route.abort());
  await load(page, s.id); await page.getByRole('button', { name: 'Quality / Final Package', exact: true }).click();
  await clickMutation(page, 'Run quality gate');
  await expect(page.getByTestId('quality-gate')).toContainText('BLOCKED');
  await expect(page.getByTestId('quality-gate')).toContainText('The architecture diagram failed to render.');
  const after: ScopingSession = await (await request.get(`/api/sessions/${s.id}`)).json();
  expect(after.gate?.issues.find(i => i.ruleId === 'diagram-render')).toMatchObject({ blocking: true, severity: 'ERROR' });
  await page.getByText('Architecture rendering check', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Application backend / AWS Lambda', exact: true })).toBeVisible();
});
