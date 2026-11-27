-- CHG-01 (Issue #50), BR-04 v0.3: maximum loan length per item category.
-- Additive: existing categories get the default 14, then the agreed values by name.
-- Existing BorrowRequest rows are not changed (requests created before the change keep their length).
ALTER TABLE "Category" ADD COLUMN "maxLoanDays" INTEGER NOT NULL DEFAULT 14;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_maxLoanDays_range" CHECK ("maxLoanDays" BETWEEN 1 AND 14);

UPDATE "Category" SET "maxLoanDays" = 7 WHERE "name" = 'Laptop';
UPDATE "Category" SET "maxLoanDays" = 3 WHERE "name" IN ('Camera', 'Projector');
