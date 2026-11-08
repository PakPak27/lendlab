// F-05 TEST-05-08 (AC-05-06, AC-05-07), SIT-01: the full Sprint 1 journey through the UI, API and database.
// borrower1 requests LAP-001 -> signs out -> custodian.hw checks it out -> signs out -> borrower1 sees it On loan.
// Needs E2E_PASSWORD (the seed password) and E2E_DATABASE_URL (the database the running server uses).
import { expect, test, type Page } from '@playwright/test';
import { canReset, db, disconnectDb, resetBorrowingData } from './helpers/db';

const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!PASSWORD || !canReset, 'Set E2E_PASSWORD and E2E_DATABASE_URL (see README, "End-to-end tests").');

test.beforeEach(resetBorrowingData);
test.afterAll(async () => {
  await resetBorrowingData();
  await disconnectDb();
});

// Optional screenshots for the Deliverable 1 PDF: set E2E_EVIDENCE_DIR to a folder.
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_EVIDENCE_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('borrower requests, custodian checks out, borrower sees the loan with its due date', async ({ page }) => {
  // 1. Borrower requests LAP-001 for 5 days.
  await signIn(page, 'borrower1@lendlab.test');
  await expect(page).toHaveURL(/\/catalog$/);
  await page.getByRole('link', { name: 'Request LAP-001' }).click();
  await page.getByLabel(/Purpose/).fill('Journey test: embedded systems assignment');
  await page.getByLabel(/Loan length/).fill('5');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page).toHaveURL(/\/my$/);
  const pending = page.getByTestId('borrow-row').filter({ hasText: 'LAP-001' });
  await expect(pending.getByText('Pending')).toBeVisible();
  await shot(page, 'journey-1-borrower-pending');
  await signOut(page);

  // 2. Custodian of HW-LAB sees it in the queue and checks it out.
  await signIn(page, 'custodian.hw@lendlab.test');
  await expect(page).toHaveURL(/\/custodian\/requests$/);
  const row = page.getByRole('row', { name: /LAP-001/ });
  await expect(row).toContainText('Borrower One');
  await expect(row).toContainText('Journey test: embedded systems assignment');
  await row.getByRole('button', { name: 'Check out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('status')).toContainText('Checked out — due');
  await expect(page.getByText('No pending requests for your locations.')).toBeVisible();
  await shot(page, 'journey-2-custodian-checked-out');
  await signOut(page);

  // 3. Borrower signs in again and sees On loan with a due date (the saved result, read back through the API).
  await signIn(page, 'borrower1@lendlab.test');
  await page.getByRole('link', { name: 'My Borrowing' }).click();
  const loaned = page.getByTestId('borrow-row').filter({ hasText: 'LAP-001' });
  await expect(loaned.getByText('On loan')).toBeVisible();
  await expect(loaned).toContainText(/\d{1,2} [A-Z][a-z]{2} \d{4}/); // the due date
  await shot(page, 'journey-3-borrower-on-loan');

  // 4. Database state matches what the screens showed.
  const saved = await db().borrowRequest.findFirstOrThrow({
    where: { item: { assetTag: 'LAP-001' } },
    include: { loan: true, item: true },
  });
  expect(saved.status).toBe('FULFILLED');
  expect(saved.item.status).toBe('ON_LOAN');
  expect(saved.loan?.status).toBe('ACTIVE');
  expect(saved.loan!.dueAt.getTime() - saved.loan!.checkedOutAt.getTime()).toBe(5 * 86_400_000);
});

test('a rule rejection: a second borrower cannot request the item that is already reserved', async ({ page }) => {
  await signIn(page, 'borrower1@lendlab.test');
  await page.getByRole('link', { name: 'Request LAP-001' }).click();
  const url = page.url();
  await page.getByLabel(/Purpose/).fill('Journey test: first request wins');
  await page.getByLabel(/Loan length/).fill('3');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page).toHaveURL(/\/my$/);
  await signOut(page);

  await signIn(page, 'borrower2@lendlab.test');
  await expect(page).toHaveURL(/\/catalog$/); // wait for the sign-in to finish before opening another page
  await page.goto(url); // opens the same request form for LAP-001
  await expect(page.getByText(/no longer available/i)).toBeVisible();
  await shot(page, 'journey-4-rule-rejection');
  expect(await db().borrowRequest.count()).toBe(1);
});
