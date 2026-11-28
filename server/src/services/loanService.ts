import type { Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { AuthUser } from './authService.js';

// F-07 Active loans and returns (contract docs/sprints/sprint-2/F-07-returns.md).

const loanNotActive = () => new AppError(409, 'LOAN_NOT_ACTIVE', 'This loan has already been returned.');
const itemNotOnLoan = () => new AppError(409, 'ITEM_NOT_ON_LOAN', 'This item is not on loan.');

// BR-05: a custodian sees only loans of items in their assigned locations (D-06: outside = not found).
export function loanScope(user: AuthUser): Prisma.LoanWhereInput {
  return { item: { locationId: { in: user.locationIds } } };
}

const activeLoanSelect = {
  id: true,
  status: true,
  checkedOutAt: true,
  dueAt: true,
  item: { select: { id: true, assetTag: true, name: true, location: { select: { code: true } } } },
  borrower: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LoanSelect;

// FR-19: active loans in the custodian's locations, soonest due first.
export async function listActiveLoans(user: AuthUser) {
  const loans = await prisma.loan.findMany({
    where: { status: 'ACTIVE', ...loanScope(user) },
    select: activeLoanSelect,
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
  });
  return { loans };
}

// FR-11 / BR-10: record a return once. Both updates run in one interactive transaction with conditional
// updates, so a second (or simultaneous) return changes nothing and gets 409.
export async function returnLoan(user: AuthUser, loanId: number, needsMaintenance: boolean) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.loan.findFirst({ where: { id: loanId, ...loanScope(user) }, select: { id: true, itemId: true } });
    if (!found) throw notFound();

    const now = new Date();
    const returned = await tx.loan.updateMany({
      where: { id: found.id, status: 'ACTIVE' },
      data: { status: 'RETURNED', returnedAt: now, returnedById: user.id },
    });
    if (returned.count === 0) throw loanNotActive();

    const item = await tx.item.updateMany({
      where: { id: found.itemId, status: 'ON_LOAN' },
      data: { status: needsMaintenance ? 'MAINTENANCE' : 'AVAILABLE' },
    });
    if (item.count === 0) throw itemNotOnLoan(); // rolls the loan update back

    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: found.id },
      select: { id: true, status: true, returnedAt: true, item: { select: { id: true, assetTag: true, status: true } } },
    });
    return { loan };
  });
}
