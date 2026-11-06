// Test database helpers for API/integration tests.
// These tests run against the real test database from .env.test (never the dev database).
import { prisma } from '../../src/lib/prisma.js';
import { seed } from '../../prisma/seed.js';

export const TEST_PASSWORD = 'test-password-123';

function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('_test')) {
    throw new Error(`Refusing to reset a non-test database. DATABASE_URL must point to a *_test database.`);
  }
}

// Empties every table and re-runs the seed, giving each test file a known starting state.
export async function resetDatabase() {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Loan", "BorrowRequest", "Session", "CustodianLocation",
                   "Item", "Category", "Location", "User"
    RESTART IDENTITY CASCADE
  `);
  await seed(prisma, TEST_PASSWORD);
}

export async function disconnect() {
  await prisma.$disconnect();
}

export { prisma };
