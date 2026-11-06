// F-01 TEST-01-10 (AC-01-08): sign in, header, sign out, protected route.
// Needs both servers running against a migrated and seeded database (see playwright.config.ts).
// The demo password is the one given to "npm run db:seed" (DEMO_USER_PASSWORD); pass it as E2E_PASSWORD.
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!PASSWORD, 'Set E2E_PASSWORD to the DEMO_USER_PASSWORD used when seeding the database.');

test('borrower signs in, sees name and role, signs out; /my redirects when signed out', async ({ page }) => {
  // Opening a protected page without a session redirects to /login.
  await page.goto('/my');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill('borrower1@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByText('Borrower One')).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Borrower' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is gone for good: a protected page redirects again.
  await page.goto('/my');
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong password shows the red alert and stays on /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('borrower1@lendlab.test');
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Invalid e-mail or password.');
  await expect(page).toHaveURL(/\/login$/);
});

test('custodian lands on the requests screen', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('custodian.hw@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/custodian\/requests$/);
  await expect(page.locator('.badge', { hasText: 'Custodian' })).toBeVisible();
});
