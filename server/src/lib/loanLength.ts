// BR-04 v0.3 (CHG-01, Issue #50): maximum loan length per item category.
// Pure function; the request service calls it inside the create transaction.
// The 1-14 whole-number shape check stays in the Zod schema (BR-04 layer 1).
export type LoanLengthCategory = { name: string; maxLoanDays: number };

export function loanLengthError(days: number, category: LoanLengthCategory): string | null {
  if (days >= 1 && days <= category.maxLoanDays) return null;
  return `Loan length for ${category.name} items must be 1–${category.maxLoanDays} days.`;
}
