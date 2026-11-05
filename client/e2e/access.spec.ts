// F-02 TEST-02-08 (AC-02-07): a borrower has no Requests menu and is turned away from the custodian screen.
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';

test.skip(!PASSWORD, 'Set E2E_PASSWORD to the DEMO_USER_PASSWORD used when seeding the database.');

test('borrower sees no Requests link and gets the no-access page on /custodian/requests', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('borrower1@lendlab.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/catalog$/);

  await expect(page.getByRole('link', { name: 'Catalog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Borrowing' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Requests' })).toHaveCount(0);

  await page.goto('/custodian/requests');
  await expect(page.getByText('You do not have access to this page.')).toBeVisible();
});

test('the API refuses the custodian queue to a borrower even when the page is bypassed', async ({ page, request }) => {
  await page.goto('/login');
  const login = await request.post('/api/auth/login', {
    data: { email: 'borrower1@lendlab.test', password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  const { token } = await login.json();

  const queue = await request.get('/api/custodian/requests', { headers: { Authorization: `Bearer ${token}` } });
  expect(queue.status()).toBe(403);
});
