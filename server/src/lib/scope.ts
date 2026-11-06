import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../services/authService.js';

// Record-level scope (decision D-06): a record outside the caller's scope is treated as not found (404).
// Every query in F-03..F-05 must spread one of these into its `where`, so scoping is never forgotten.

// BR-06: a borrower sees only their own requests and loans.
export function borrowerScope(user: AuthUser): { borrowerId: number } {
  return { borrowerId: user.id };
}

// BR-05: a custodian sees only records for items in their assigned locations.
export function custodianScope(user: AuthUser): Prisma.BorrowRequestWhereInput {
  return { item: { locationId: { in: user.locationIds } } };
}
