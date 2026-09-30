import { expect, test } from '@playwright/test';

test('Phase 1 evaluator reviews sources, scope, assumptions and gaps, then approval is invalidated by an edit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Seed scenario').selectOption('integration-heavy');
  await page.getByRole('button', { name: 'Start seed session' }).click();
  await expect(page.getByLabel('Customer requirements')).toContainText('Existing CRM is Salesforce.');
  await page.getByRole('button', { name: 'Analyze with MOCK' }).click();
  await page.getByRole('button', { name: 'Inspect INT_01', exact: true }).click();
  await expect(page.getByTestId('requirement-detail').getByTestId('source-evidence')).toContainText('Existing CRM is Salesforce.');
  await expect(page.getByTestId('requirement-detail')).toContainText('CUSTOMER_STATED');
  await expect(page.getByTestId('requirement-detail').getByTestId('source-evidence')).toContainText('DIRECT');
  await expect(page.getByRole('heading', { name: 'Assumptions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Missing information & questions', exact: true })).toBeVisible();
  await expect(page.getByText('PROVISIONAL', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('scope-status')).toContainText('NOT_READY');
  for (const id of ['BR_01', 'INT_01', 'INT_02', 'DATA_01', 'FR_01']) {
    await page.getByRole('button', { name: `Inspect ${id}`, exact: true }).click();
    await page.getByRole('button', { name: `Review ${id}`, exact: true }).click();
    await expect(page.getByTestId('requirement-detail')).toContainText('REVIEWED');
  }
  await page.getByRole('button', { name: 'Review ASM_01', exact: true }).click();
  await page.getByRole('button', { name: 'Review Q_01', exact: true }).click();
  await expect(page.getByTestId('scope-status')).toContainText('READY_FOR_REVIEW');
  await page.getByRole('button', { name: 'Approve reviewed scope' }).click();
  await expect(page.getByTestId('scope-status')).toContainText('APPROVED');
  await page.getByRole('button', { name: 'PRD & Scope', exact: true }).click();
  await expect(page.getByText('Scope eligible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate PRD and scope' })).toBeEnabled();
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect INT_01', exact: true }).click();
  await page.getByRole('button', { name: 'Edit requirement' }).click();
  await page.getByLabel('Requirement priority').selectOption('HIGH');
  await page.getByRole('button', { name: 'Save requirement' }).click();
  await expect(page.getByTestId('scope-status')).toContainText('NOT_READY');
  await expect(page.getByTestId('requirement-detail')).toContainText('DRAFT');
  await page.reload();
  await page.getByRole('button', { name: 'Inspect INT_01', exact: true }).click();
  await expect(page.getByTestId('requirement-detail').getByTestId('source-evidence')).toContainText('Existing CRM is Salesforce.');
  await expect(page.getByTestId('requirement-detail')).toContainText('HIGH');
  await page.getByTestId('requirement-detail').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/phase1-review-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phase1-review-mobile.png' });
});

test('custom Markdown is stored exactly and unsupported mock analysis preserves it safely', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Customer name').fill('Custom source'); await page.getByLabel('Opportunity name').fill('Exact text');
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  const source = '  # Notes 🧭\n<script>window.customerScriptExecuted=true</script>\nNeed a portal.  \n';
  await page.getByLabel('Input format').selectOption('PASTED_MARKDOWN'); await page.getByLabel('Customer requirements').fill(source);
  await page.getByRole('button', { name: 'Save customer input', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze with MOCK' }).click();
  await expect(page.getByRole('alert')).toContainText('no recorded MOCK analysis');
  await expect(page.getByLabel('Customer requirements')).toHaveValue(source);
  expect(await page.evaluate(() => 'customerScriptExecuted' in window)).toBe(false);
  await page.reload(); await expect(page.getByLabel('Customer requirements')).toHaveValue(source);
});
