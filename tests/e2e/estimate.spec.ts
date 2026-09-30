import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
async function acceptedDelivery(request: APIRequestContext, page: Page, seedId = 'integration-heavy') {
  let s = await (await request.post('/api/sessions/seed', { data: { seedId } })).json();
  const post = async (path: string, body: object = {}) => { const response = await request.post(`/api/sessions/${s.id}/${path}`, { data: { expectedRevision: s.revision, ...body } }); expect(response.ok(), await response.text()).toBe(true); s = await response.json(); };
  await post('analyze');
  for (const kind of ['requirements', 'assumptions', 'questions']) for (const id of Object.keys(s[kind])) await post(`${kind}/${id}/review`);
  await post('approve');
  for (const operation of ['prd-scope', 'architecture', 'strategies', 'delivery']) {
    await post('generate', { operation }); const run = Object.values(s.generationRuns).at(-1) as { id: string; proposals: { target: { id: string } }[] };
    for (const p of run.proposals) await post(`runs/${run.id}/sections/${p.target.id}/review`, { decision: 'ACCEPTED' });
  }
  await page.goto('/'); await page.getByLabel('Session ID', { exact: true }).fill(s.id); await page.getByRole('button', { name: 'Load session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved locally'); await page.getByRole('button', { name: 'Estimate', exact: true }).click();
  return s.id as string;
}
async function reviewedEstimate(page: Page) {
  await page.getByRole('button', { name: 'Prepare estimation proposals' }).click();
  await expect(page.getByRole('button', { name: 'Accept reviewed estimation basis' })).toBeVisible();
  await page.getByRole('checkbox', { name: /I have reviewed the displayed inventory/ }).check();
  await page.getByRole('button', { name: 'Accept reviewed estimation basis' }).click();
  await page.getByRole('button', { name: 'Calculate estimate', exact: true }).click();
  await expect(page.getByTestId('estimate-summary')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
}
test('Phase 3 evaluator inspects drivers and ledger, changes rate/contingency and reloads', async ({ page, request }) => {
  test.setTimeout(180000); await acceptedDelivery(request, page); await reviewedEstimate(page);
  const effort = await page.getByTestId('estimate-effort').innerText(), rom = await page.getByTestId('estimate-rom').innerText();
  const stream = page.getByTestId('estimate-workstream').filter({ has: page.locator('summary', { hasText: 'Application, data and integration' }) });
  await stream.locator(':scope > summary').click(); const unit = stream.getByTestId('estimate-unit').first(); await unit.locator(':scope > summary').click();
  await expect(unit.getByText(/Deterministic:/)).toBeVisible(); await unit.getByText(/^Calculation ledger AS_/).click();
  await expect(unit).toContainText('one adjustment'); await expect(unit).toContainText('demo-rom-v1');
  await page.getByLabel('Rate E minor units per day').fill('95000'); await page.getByRole('button', { name: 'Save rate E', exact: true }).click();
  await expect(page.getByTestId('estimate-rom')).not.toHaveText(rom); await expect(page.getByTestId('estimate-effort')).toHaveText(effort);
  const base = (await page.getByTestId('estimate-base').innerText()).split(' · Contingency')[0]!;
  const changedRom = await page.getByTestId('estimate-rom').innerText();
  await page.getByLabel('Contingency percent').fill('20'); await page.getByRole('button', { name: 'Save contingency', exact: true }).click();
  await expect(page.getByTestId('estimate-rom')).not.toHaveText(changedRom); await expect(page.getByTestId('estimate-base')).toContainText(base); await expect(page.getByTestId('estimate-effort')).toHaveText(effort);
  await expect(page.getByTestId('estimate-limitations')).toContainText('confidence');
  await page.getByTestId('estimate-summary').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/phase3-estimate-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/phase3-estimate-mobile.png' });
  await page.reload(); await page.getByRole('button', { name: 'Estimate', exact: true }).click(); await expect(page.getByTestId('estimate-effort')).toHaveText(effort);
});
test('Phase 3 missing rate preserves effort and shows unavailable ROM, currency never invents FX', async ({ page, request }) => {
  test.setTimeout(180000); await acceptedDelivery(request, page); await reviewedEstimate(page);
  const effort = await page.getByTestId('estimate-effort').innerText();
  await page.getByRole('button', { name: 'Clear rate E', exact: true }).click();
  await expect(page.getByTestId('estimate-rom')).toContainText('Unavailable'); await expect(page.getByTestId('estimate-effort')).toHaveText(effort); await expect(page.getByTestId('estimate-limitations')).toContainText('rates.E');
  await page.getByLabel('Currency code', { exact: true }).fill('EUR'); await page.getByRole('button', { name: 'Save currency and invalidate rates' }).click(); await expect(page.getByTestId('estimate-rom')).toContainText('Unavailable');
  await expect(page.getByTestId('estimate-summary')).toContainText('commercials LOW'); await expect(page.getByRole('alert')).toHaveCount(0);
});
