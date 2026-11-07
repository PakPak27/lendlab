import { AppError, notFound } from '../lib/errors.js';
import { computeDueDate } from '../lib/dates.js';
import { prisma } from '../lib/prisma.js';
import { isUniqueViolation } from '../lib/prismaErrors.js';
import { custodianScope } from '../lib/scope.js';
import type { AuthUser } from './authService.js';

const requestNotPending = () =>
  new AppError(409, 'REQUEST_NOT_PENDING', 'This request is no longer pending.');
const itemNotAvailable = () =>
  new AppError(409, 'ITEM_NOT_AVAILABLE', 'This item is not available to hand over.');

// FR-07: pending requests for the custodian's own locations (BR-05), oldest first.
export async function listPendingRequests(user: AuthUser) {
  const rows = await prisma.borrowRequest.findMany({
    where: { status: 'PENDING', ...custodianScope(user) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      status: true,
      purpose: true,
      requestedDays: true,
      createdAt: true,
      borrower: { select: { id: true, name: true, email: true } },
      item: { select: { id: true, assetTag: true, name: true, location: { select: { code: true } } } },
    },
  });
  return { requests: rows };
}

// FR-08 / BR-03: check out one pending request. Steps 2-4 run in ONE interactive transaction, so
// either all of them happen or none do, and two simultaneous checkouts cannot both succeed.
export async function checkoutRequest(user: AuthUser, requestId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Load the request with its item. Outside the custodian's locations counts as "not found" (D-06).
      const found = await tx.borrowRequest.findFirst({
        where: { id: requestId, ...custodianScope(user) },
        select: { id: true, itemId: true, borrowerId: true, requestedDays: true },
      });
      if (!found) throw notFound();

      // 2. Pending -> Fulfilled. If another checkout (or a cancellation) got there first, 0 rows change.
      const now = new Date();
      const claimed = await tx.borrowRequest.updateMany({
        where: { id: found.id, status: 'PENDING' },
        data: { status: 'FULFILLED', decidedById: user.id, decidedAt: now },
      });
      if (claimed.count === 0) throw requestNotPending();

      // 3. Reserved -> On loan. If the item is no longer reserved, throwing rolls step 2 back.
      const reserved = await tx.item.updateMany({
        where: { id: found.itemId, status: 'RESERVED' },
        data: { status: 'ON_LOAN' },
      });
      if (reserved.count === 0) throw itemNotAvailable();

      // 4. The loan, with its due date (BR-04).
      const loan = await tx.loan.create({
        data: {
          requestId: found.id,
          itemId: found.itemId,
          borrowerId: found.borrowerId,
          checkedOutById: user.id,
          checkedOutAt: now,
          dueAt: computeDueDate(now, found.requestedDays),
        },
        select: {
          id: true,
          status: true,
          requestId: true,
          checkedOutAt: true,
          dueAt: true,
          item: { select: { id: true, assetTag: true, status: true } },
          borrower: { select: { id: true, name: true } },
        },
      });
      return { loan };
    });
  } catch (err) {
    // The database is the last line of defence (BR-02): map its unique violations to the right rule.
    if (isUniqueViolation(err, 'requestId')) throw requestNotPending();
    if (isUniqueViolation(err)) throw itemNotAvailable();
    throw err;
  }
}
