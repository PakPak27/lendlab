// F-05 TEST-05-08 (AC-05-07), custodian half of the Sprint 1 journey: queue -> confirm -> toast -> row gone.
// The borrower half (creating the request in the UI) arrives with F-04, so the pending request is
// prepared directly in the database. Needs E2E_PASSWORD (the seed password) and E2E_DATABASE_URL
// (the database the running server uses).
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? '';
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? '';

test.skip(!PASSWORD || !DATABASE_URL, 'Set E2E_PASSWORD and E2E_DATABASE_URL (see playwright.config.ts).');

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function resetLaptop() {
  await prisma.loan.deleteMany();
  await prisma.borrowRequest.deleteMany();
  await prisma.item.updateMany({ data: { status: 'AVAILABLE' }, where: { assetTag: { in: ['LAP-001', 'CAM-001'] } } });
}

async function pendingRequestFor(assetTag: string) {
  const borrower = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower1@lendlab.test' } });
  const item = await prisma.item.findUniqueOrThrow({ where: { assetTag } });
  await prisma.item.update({ where: { id: item.id }, data: { status: 'RESERVED' } });
  return prisma.borrowRequest.create({
    data: { itemId: item.id, borrowerId: borrower.id, purpose: 'E2E: embedded systems assignment', requestedDays: 7 },
  });
}

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Optional evidence screenshots for the Deliverable 1 PDF: set E2E_EVIDENCE_DIR to a folder.
async function shot(page: import('@playwright/test').Page, name: string) {
  const dir = process.env.E2E_EVIDENCE_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test.beforeEach(resetLaptop);
test.afterAll(async () => {
  await resetLaptop();
  await prisma.$disconnect();
});

test('custodian checks out a pending request; the loan and item state are saved', async ({ page }) => {
  const req = await pendingRequestFor('LAP-001');

  await signIn(page, 'custodian.hw@lendlab.test');
  await expect(page).toHaveURL(/\/custodian\/requests$/);
  const row = page.getByRole('row', { name: /LAP-001/ });
  await expect(row).toContainText('Borrower One');

  await row.getByRole('button', { name: 'Check out' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Hand over LAP-001 to Borrower One for 7 days?');
  await shot(page, 'confirm-dialog');
  await dialog.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByRole('status')).toContainText('Checked out — due');
  await shot(page, 'checked-out-toast');
  await expect(page.getByRole('row', { name: /LAP-001/ })).toHaveCount(0);
  await expect(page.getByText('No pending requests for your locations.')).toBeVisible();

  // Persisted result (the "retrieve the saved result" step).
  const saved = await prisma.borrowRequest.findUniqueOrThrow({ where: { id: req.id }, include: { loan: true, item: true } });
  expect(saved.status).toBe('FULFILLED');
  expect(saved.item.status).toBe('ON_LOAN');
  expect(saved.loan?.status).toBe('ACTIVE');
});

test('a custodian of another location does not see the request', async ({ page }) => {
  await pendingRequestFor('LAP-001'); // HW-LAB item

  await signIn(page, 'custodian.media@lendlab.test');
  await expect(page).toHaveURL(/\/custodian\/requests$/);
  await expect(page.getByText('No pending requests for your locations.')).toBeVisible();
  await expect(page.getByText('LAP-001')).toHaveCount(0);
});
