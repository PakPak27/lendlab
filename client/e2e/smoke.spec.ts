// SYS-01 smoke test: the app loads and reaches the API and database.
import { expect, test } from '@playwright/test';

test('home page loads and shows the API/database as connected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'LendLab' })).toBeVisible();
  await expect(page.getByText('API and database are connected.')).toBeVisible();
});
