// F-04 TEST-04-11 (AC-04-07): a borrower requests an Available item and sees it Pending on My Borrowing.
// Needs both servers running against a FRESHLY SEEDED database (this test reserves LAP-001);
// reset with `npx prisma migrate reset --force` in server/ before re-running. Pass the seed password as E2E_PASSWORD.
import { expect, test } from '@playwright/test';
import { resetBorrowingData } from './helpers/db';

const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.beforeEach(resetBorrowingData); // no-op unless E2E_DATABASE_URL is set

test.skip(!PASSWORD, 'Set E2E_PASSWORD to the DEMO_USER_PASSWORD used when seeding the database.');

test('borrower requests LAP-001, sees it Pending, and the catalog shows it Reserved', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('borrower1@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/catalog$/);

  await page.getByRole('link', { name: 'Request LAP-001' }).click();
  await expect(page).toHaveURL(/\/catalog\/\d+\/request$/);
  await page.getByLabel(/Purpose/).fill('Embedded systems lab assignment 3');
  await page.getByLabel(/Loan length/).fill('7');
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(page).toHaveURL(/\/my$/);
  await expect(page.getByText('Request submitted for LAP-001.')).toBeVisible();
  const row = page.getByTestId('borrow-row').filter({ hasText: 'LAP-001' });
  await expect(row.getByText('Pending')).toBeVisible();

  await page.getByRole('link', { name: 'Catalog' }).click();
  const item = page.getByTestId('catalog-item').filter({ hasText: 'LAP-001' });
  await expect(item.getByText('Reserved')).toBeVisible();
  await expect(item.getByRole('button', { name: 'Request LAP-001' })).toBeDisabled();
});

test('requesting the Maintenance item ARD-003 is not possible', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('borrower2@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/catalog$/);

  await expect(page.getByRole('button', { name: 'Request ARD-003' })).toBeDisabled();
});
