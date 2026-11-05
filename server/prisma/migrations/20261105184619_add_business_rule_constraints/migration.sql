-- Business-rule constraints that the Prisma schema language cannot express.
-- Copy this SQL into the migration created with:
--   npx prisma migrate dev --create-only --name add_business_rule_constraints

-- BR-02: an item can have at most one PENDING request.
CREATE UNIQUE INDEX "BorrowRequest_one_pending_per_item"
  ON "BorrowRequest" ("itemId") WHERE "status" = 'PENDING';

-- BR-02 / BR-03: an item can have at most one ACTIVE loan.
CREATE UNIQUE INDEX "Loan_one_active_per_item"
  ON "Loan" ("itemId") WHERE "status" = 'ACTIVE';

-- BR-04: requested loan length is 1-14 days.
ALTER TABLE "BorrowRequest"
  ADD CONSTRAINT "BorrowRequest_requestedDays_range" CHECK ("requestedDays" BETWEEN 1 AND 14);
