// F-08 BR-11: a loan is overdue when it is Active and the current time is after its due date.
// Calculated when read (no stored flag); exactly at the due time is not overdue; a Returned loan never is.
export type LoanForOverdue = { status: 'ACTIVE' | 'RETURNED'; dueAt: Date };

export function isOverdue(loan: LoanForOverdue, now: Date): boolean {
  return loan.status === 'ACTIVE' && now.getTime() > loan.dueAt.getTime();
}

// Adds isOverdue to a loan object read from the database (API responses, F-08 section 5).
export function withOverdue<T extends LoanForOverdue>(loan: T, now: Date = new Date()): T & { isOverdue: boolean } {
  return { ...loan, isOverdue: isOverdue(loan, now) };
}
