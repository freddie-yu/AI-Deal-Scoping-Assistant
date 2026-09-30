import { expect, test } from '@playwright/test';
test('six-area MOCK shell creates and reloads a foundation session', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Deal Scoping Assistant' })).toBeVisible();
  await expect(page.getByText('MOCK', { exact: true })).toBeVisible();
  const areas = ['Requirements', 'PRD & Scope', 'Architecture', 'Data / Integration / AI', 'Estimate', 'Quality / Final Package'];
  for (const area of areas) {
    await page.getByRole('button', { name: area, exact: true }).click();
    await expect(page.getByRole('heading', { name: area, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByLabel('Customer name').fill('Smoke customer');
  await page.getByLabel('Opportunity name').fill('Foundation smoke');
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved locally');
  await page.reload();
  await expect(page.getByText('Foundation smoke', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
