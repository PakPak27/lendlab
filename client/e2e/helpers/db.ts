// E2E helper: puts borrowing data back to the freshly seeded state, so specs do not depend on the order
// they run in. Needs E2E_DATABASE_URL (the database the running server uses). Without it, nothing is reset
// and the specs that need a clean database expect a freshly seeded one.
import { PrismaClient } from '@prisma/client';

export const DATABASE_URL = process.env.E2E_DATABASE_URL ?? '';
export const canReset = Boolean(DATABASE_URL);

let client: PrismaClient | undefined;
export function db(): PrismaClient {
  client ??= new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  return client;
}

// Same state as "npm run db:seed" on an empty database: no requests or loans, every item Available
// except ARD-003, which the seed puts in Maintenance.
export async function resetBorrowingData(): Promise<void> {
  if (!canReset) return;
  const prisma = db();
  await prisma.loan.deleteMany();
  await prisma.borrowRequest.deleteMany();
  await prisma.item.updateMany({ data: { status: 'AVAILABLE' } });
  await prisma.item.updateMany({ where: { assetTag: 'ARD-003' }, data: { status: 'MAINTENANCE' } });
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
