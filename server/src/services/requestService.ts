import type { Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { loanLengthError } from '../lib/loanLength.js';
import { prisma } from '../lib/prisma.js';
import { isUniqueViolation } from '../lib/prismaErrors.js';
import { borrowerScope } from '../lib/scope.js';
import type { CreateRequestInput } from '../schemas/requestSchemas.js';
import type { AuthUser } from './authService.js';

// F-04 Borrow Request and My Borrowing (contract docs/sprints/sprint-1/F-04-borrow-request.md).

const itemNotAvailable = () => new AppError(409, 'ITEM_NOT_AVAILABLE', 'This item is not available to request.');
const requestNotPending = () => new AppError(409, 'REQUEST_NOT_PENDING', 'This request is no longer pending.');

// The shape returned for one request (contract section 5).
const requestSelect = {
  id: true,
  status: true,
  purpose: true,
  requestedDays: true,
  createdAt: true,
  decidedAt: true, // F-06: when it was rejected or cancelled
  decisionNote: true, // F-06: the custodian's rejection reason
  item: { select: { id: true, assetTag: true, name: true, status: true } },
  loan: { select: { id: true, status: true, checkedOutAt: true, dueAt: true, returnedAt: true } }, // F-07: returnedAt
} satisfies Prisma.BorrowRequestSelect;

// BR-01 / BR-02: create a PENDING request and reserve the item, atomically.
// The conditional update only succeeds while the item is AVAILABLE. If two borrowers race for
// the same item, PostgreSQL locks the row: the second update waits, re-checks the status, finds
// RESERVED, changes 0 rows, and that request gets 409. The partial unique index
// "BorrowRequest_one_pending_per_item" is the last line of defence (NFR-05).
export async function createRequest(user: AuthUser, input: CreateRequestInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id: input.itemId },
        select: { id: true, category: { select: { name: true, maxLoanDays: true } } },
      });
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
      }

      // BR-04 v0.3 (CHG-01): the length must not exceed the item category's maximum.
      // Checked before the conditional update, so a 400 reserves nothing (contract step 3.2).
      const tooLong = loanLengthError(input.requestedDays, item.category);
      if (tooLong) {
        throw new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', [
          { field: 'requestedDays', message: tooLong },
        ]);
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

// F-06 FR-10 / BR-09: the borrower cancels their own Pending request; the item goes back to Available.
// One transaction with conditional updates, so a checkout or rejection at the same moment cannot also succeed.
export async function cancelMyRequest(user: AuthUser, id: number) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.borrowRequest.findFirst({ where: { id, ...borrowerScope(user) }, select: { id: true, itemId: true } });
    if (!found) throw notFound('The requested borrow request was not found.');

    const now = new Date();
    const cancelled = await tx.borrowRequest.updateMany({
      where: { id: found.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedById: user.id, decidedAt: now },
    });
    if (cancelled.count === 0) throw requestNotPending();

    await tx.item.updateMany({ where: { id: found.itemId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
    return tx.borrowRequest.findUniqueOrThrow({ where: { id: found.id }, select: requestSelect });
  });
}
