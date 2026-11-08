// SYS-01 smoke test: the app loads and the API reaches the database.
import { expect, test } from '@playwright/test';

test('app loads at /login and the API reports the database as connected', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/); // signed-out visitors are sent to the login screen
  await expect(page.getByRole('link', { name: 'LendLab' })).toBeVisible();

  const ready = await request.get('/api/ready');
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ db: 'connected' });
});
