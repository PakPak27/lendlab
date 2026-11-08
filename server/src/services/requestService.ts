import type { Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { isUniqueViolation } from '../lib/prismaErrors.js';
import { borrowerScope } from '../lib/scope.js';
import type { CreateRequestInput } from '../schemas/requestSchemas.js';
import type { AuthUser } from './authService.js';

// F-04 Borrow Request and My Borrowing (contract docs/sprints/sprint-1/F-04-borrow-request.md).

const itemNotAvailable = () => new AppError(409, 'ITEM_NOT_AVAILABLE', 'This item is not available to request.');

// The shape returned for one request (contract section 5).
const requestSelect = {
  id: true,
  status: true,
  purpose: true,
  requestedDays: true,
  createdAt: true,
  item: { select: { id: true, assetTag: true, name: true, status: true } },
  loan: { select: { id: true, status: true, checkedOutAt: true, dueAt: true } },
} satisfies Prisma.BorrowRequestSelect;

// BR-01 / BR-02: create a PENDING request and reserve the item, atomically.
// The conditional update only succeeds while the item is AVAILABLE. If two borrowers race for
// the same item, PostgreSQL locks the row: the second update waits, re-checks the status, finds
// RESERVED, changes 0 rows, and that request gets 409. The partial unique index
// "BorrowRequest_one_pending_per_item" is the last line of defence (NFR-05).
export async function createRequest(user: AuthUser, input: CreateRequestInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: input.itemId }, select: { id: true } });
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
      }

      const reserved = await tx.item.updateMany({
        where: { id: input.itemId, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (reserved.count !== 1) {
        throw itemNotAvailable(); // rolls back the transaction
      }

      return tx.borrowRequest.create({
        data: {
          itemId: input.itemId,
          borrowerId: user.id,
          purpose: input.purpose,
          requestedDays: input.requestedDays,
        },
        select: requestSelect,
      });
    });
  } catch (err) {
    // The only unique constraint this transaction can hit is "one PENDING request per item".
    if (isUniqueViolation(err)) throw itemNotAvailable();
    throw err;
  }
}

// FR-06 / BR-06: the caller's own requests, newest first.
export function listMyRequests(user: AuthUser) {
  return prisma.borrowRequest.findMany({
    where: borrowerScope(user),
    select: requestSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

// BR-06 / decision D-06: another borrower's request is reported as not found.
export async function getMyRequest(user: AuthUser, id: number) {
  const request = await prisma.borrowRequest.findFirst({
    where: { id, ...borrowerScope(user) },
    select: requestSelect,
  });
  if (!request) throw notFound('The requested borrow request was not found.');
  return request;
}
