// BR-04 per-category maximum loan length (CHG-01, Issue #50).
// Pre-change stub for the RED commit: the Sprint 1 rule has no per-category limit,
// so every length that passed the 1-14 schema check is accepted.
export type LoanLengthCategory = { name: string; maxLoanDays: number };

export function loanLengthError(_days: number, _category: LoanLengthCategory): string | null {
  return null;
}
