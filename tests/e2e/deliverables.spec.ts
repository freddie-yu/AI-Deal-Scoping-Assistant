import { expect, test, type Page } from '@playwright/test';
async function approve(page: Page, seed: string) {
  await page.goto('/'); await page.getByLabel('Seed scenario').selectOption(seed); await page.getByRole('button', { name: 'Start seed session' }).click();
  await page.getByRole('button', { name: 'Analyze with MOCK' }).click();
  const ids = seed === 'integration-heavy' ? ['BR_01', 'INT_01', 'INT_02', 'DATA_01', 'FR_01'] : ['FR_01', 'FR_02', 'SEC_01', 'DATA_01'];
  for (const id of ids) { await page.getByRole('button', { name: `Inspect ${id}`, exact: true }).click(); await page.getByRole('button', { name: `Review ${id}`, exact: true }).click(); await expect(page.getByTestId('requirement-detail')).toContainText('REVIEWED'); }
  await page.getByRole('button', { name: 'Review ASM_01', exact: true }).click(); await page.getByRole('button', { name: 'Review Q_01', exact: true }).click();
  await page.getByRole('button', { name: 'Approve reviewed scope' }).click(); await expect(page.getByTestId('scope-status')).toContainText('APPROVED');
}
async function acceptAllIndividually(page: Page) {
  while (await page.getByRole('button', { name: /^Accept AS_/ }).count()) {
    const button = page.getByRole('button', { name: /^Accept AS_/ }).first(); const name = await button.getAttribute('aria-label');
    await button.click(); await expect(page.getByRole('button', { name: name!, exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
}
test('Phase 2 reviewer traces, accepts and persists connected Salesforce deliverables', async ({ page }) => {
  test.setTimeout(120000); await approve(page, 'integration-heavy');
  await page.getByRole('button', { name: 'PRD & Scope', exact: true }).click(); await page.getByRole('button', { name: 'Generate PRD and scope' }).click();
  const cap = page.getByTestId('artifact-section').filter({ has: page.getByRole('heading', { name: 'Existing CRM is Salesforce.', exact: true }) });
  await cap.getByText('Why? Grounding and source evidence', { exact: true }).click(); await cap.getByText('Inspect linked INT_01', { exact: true }).click();
  await expect(cap.getByTestId('source-evidence')).toContainText('Existing CRM is Salesforce.'); await expect(cap).toContainText('REQUESTED');
  await expect(page.getByTestId('scope-coverage')).toContainText('0/5'); await acceptAllIndividually(page); await expect(page.getByTestId('scope-coverage')).toContainText('5/5');
  await page.getByRole('button', { name: 'Architecture', exact: true }).click(); await page.getByRole('button', { name: 'Generate AWS architecture' }).click();
  await expect(page.getByTestId('architecture-diagram').locator('svg')).toBeVisible(); await expect(page.getByText('Supported in this submission: AWS.', { exact: false })).toBeVisible();
  const adapter = page.getByTestId('artifact-section').filter({ has: page.getByRole('heading', { name: 'Salesforce adapter', exact: true }) });
  await adapter.getByText('Why? Grounding and source evidence', { exact: true }).click(); await adapter.getByText('Inspect linked INT_01', { exact: true }).click(); await expect(adapter.getByTestId('source-evidence')).toContainText('Salesforce');
  await page.getByTestId('architecture-diagram').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/phase2-architecture-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: 'test-results/phase2-architecture-mobile.png' }); await page.setViewportSize({ width: 1280, height: 900 });
  await acceptAllIndividually(page);
  await page.getByRole('button', { name: 'Data / Integration / AI', exact: true }).click(); await page.getByRole('button', { name: 'Generate data, integration and AI strategy' }).click();
  const integration = page.getByTestId('artifact-section').filter({ has: page.getByRole('heading', { name: 'Salesforce integration', exact: true }) });
  await integration.getByText('Inspect structured Integration details', { exact: true }).click(); await expect(integration).toContainText('exponential backoff'); await expect(integration).toContainText('reconcile');
  await integration.getByText('Why? Grounding and source evidence', { exact: true }).click(); await integration.getByText('Inspect linked INT_01', { exact: true }).click(); await expect(integration.getByTestId('source-evidence')).toContainText('Salesforce');
  await acceptAllIndividually(page); await page.getByRole('button', { name: /^Accepted/ }).click(); await expect(page.getByRole('heading', { name: 'Salesforce integration' })).toBeVisible();
  await page.getByRole('button', { name: 'Estimate', exact: true }).click(); await page.getByRole('button', { name: 'Propose delivery workstreams' }).click(); await expect(page.getByRole('heading', { name: 'Application, data and integration', exact: true })).toBeVisible(); await acceptAllIndividually(page);
  await page.reload(); await page.getByRole('button', { name: 'Data / Integration / AI', exact: true }).click(); await page.getByRole('button', { name: /^Accepted/ }).click(); await expect(page.getByRole('heading', { name: 'Salesforce integration' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('invalidating approval blocks Phase 2 in the browser and API', async ({ page, request }) => {
  await approve(page, 'integration-heavy');
  await page.getByRole('button', { name: 'Inspect INT_01', exact: true }).click(); await page.getByRole('button', { name: 'Edit requirement' }).click(); await page.getByLabel('Requirement priority').selectOption('HIGH'); await page.getByRole('button', { name: 'Save requirement' }).click();
  await expect(page.getByTestId('scope-status')).toContainText('NOT_READY'); await page.getByRole('button', { name: 'PRD & Scope', exact: true }).click(); await expect(page.getByRole('button', { name: 'Generate PRD and scope' })).toBeDisabled();
  const id = await page.evaluate(() => localStorage.getItem('scoping-session-id')); const session = await (await request.get(`/api/sessions/${id}`)).json() as { revision: number };
  const response = await request.post(`/api/sessions/${id}/generate`, { data: { expectedRevision: session.revision, operation: 'prd-scope' } }); expect(response.status()).toBe(400);
});
test('rejecting a component clears the obsolete SVG and retains the fallback inventory', async ({ page, request }) => {
  test.setTimeout(60000); await approve(page, 'integration-heavy');
  const id = await page.evaluate(() => localStorage.getItem('scoping-session-id'));
  let session = await (await request.get(`/api/sessions/${id}`)).json();
  session = await (await request.post(`/api/sessions/${id}/generate`, { data: { expectedRevision: session.revision, operation: 'prd-scope' } })).json();
  const runs = Object.values(session.generationRuns) as { id: string; proposals: { target: { id: string } }[] }[]; const run = runs.at(-1)!;
  for (const p of run.proposals) session = await (await request.post(`/api/sessions/${id}/runs/${run.id}/sections/${p.target.id}/review`, { data: { expectedRevision: session.revision, decision: 'ACCEPTED' } })).json();
  await page.reload(); await page.getByRole('button', { name: 'Architecture', exact: true }).click(); await page.getByRole('button', { name: 'Generate AWS architecture' }).click();
  await expect(page.getByTestId('architecture-diagram').locator('svg')).toBeVisible();
  const db = page.getByTestId('artifact-section').filter({ has: page.getByRole('heading', { name: 'Transactional records', exact: true }) });
  await db.getByRole('button', { name: /^Reject AS_/ }).click();
  await expect(page.getByTestId('architecture-diagram').locator('svg')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('referenced component is unavailable');
  await expect(page.getByRole('cell', { name: 'Application backend / aws:lambda', exact: true })).toBeVisible();
});
