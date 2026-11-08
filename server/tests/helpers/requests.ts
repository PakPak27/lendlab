// Test data helper: builds "Pending request, item Reserved" directly in the database,
// so checkout tests do not depend on the borrower-side endpoint.
import { prisma } from './db.js';

export async function createPendingRequest(opts: {
  assetTag: string;
  borrowerEmail?: string;
  requestedDays?: number;
  createdAt?: Date;
  purpose?: string;
}) {
  const borrower = await prisma.user.findUniqueOrThrow({ where: { email: opts.borrowerEmail ?? 'borrower1@lendlab.test' } });
  const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: opts.assetTag } });
  await prisma.item.update({ where: { id: item.id }, data: { status: 'RESERVED' } });
  const request = await prisma.borrowRequest.create({
    data: {
      itemId: item.id,
      borrowerId: borrower.id,
      purpose: opts.purpose ?? 'Embedded systems lab assignment',
      requestedDays: opts.requestedDays ?? 7,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  return { borrower, item, request };
}
