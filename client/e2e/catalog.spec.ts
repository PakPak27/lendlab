// F-03 TEST-03-05 (AC-03-05): a borrower sees item statuses and can request only Available items.
// Needs both servers running against a freshly seeded database; pass the seed password as E2E_PASSWORD.
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!PASSWORD, 'Set E2E_PASSWORD to the DEMO_USER_PASSWORD used when seeding the database.');

test('borrower sees LAP-001 Available with Request enabled and ARD-003 Maintenance with Request disabled', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('borrower1@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/catalog$/);

  const lap = page.getByTestId('catalog-item').filter({ hasText: 'LAP-001' });
  await expect(lap.getByText('Available')).toBeVisible();
  await expect(lap.getByRole('link', { name: 'Request LAP-001' })).toBeVisible();

  const ard = page.getByTestId('catalog-item').filter({ hasText: 'ARD-003' });
  await expect(ard.getByText('Maintenance')).toBeVisible();
  await expect(ard.getByRole('button', { name: 'Request ARD-003' })).toBeDisabled();

  // Filter: only Maintenance items remain.
  await page.getByLabel('Status').selectOption('MAINTENANCE');
  await expect(page.getByTestId('catalog-item')).toHaveCount(1);
  await expect(page.getByTestId('catalog-item')).toContainText('ARD-003');
});
