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

// Sprint 2 (F-07, F-08, F-09): builds "Fulfilled request + Active loan, item On Loan" directly in the database.
export async function createActiveLoan(opts: {
  assetTag: string;
  borrowerEmail?: string;
  custodianEmail?: string;
  checkedOutAt?: Date;
  dueAt?: Date;
}) {
  const borrower = await prisma.user.findUniqueOrThrow({ where: { email: opts.borrowerEmail ?? 'borrower1@lendlab.test' } });
  const custodian = await prisma.user.findUniqueOrThrow({ where: { email: opts.custodianEmail ?? 'custodian.hw@lendlab.test' } });
  const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: opts.assetTag } });
  const checkedOutAt = opts.checkedOutAt ?? new Date();
  const dueAt = opts.dueAt ?? new Date(checkedOutAt.getTime() + 7 * 86_400_000);
  await prisma.item.update({ where: { id: item.id }, data: { status: 'ON_LOAN' } });
  const request = await prisma.borrowRequest.create({
    data: {
      itemId: item.id,
      borrowerId: borrower.id,
      purpose: 'Embedded systems lab assignment',
      requestedDays: 7,
      status: 'FULFILLED',
      decidedById: custodian.id,
      decidedAt: checkedOutAt,
    },
  });
  const loan = await prisma.loan.create({
    data: { requestId: request.id, itemId: item.id, borrowerId: borrower.id, checkedOutById: custodian.id, checkedOutAt, dueAt },
  });
  return { borrower, item, request, loan };
}
