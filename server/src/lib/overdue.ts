// F-08 BR-11 overdue rule. RED stub: the Sprint 1 code has no overdue rule, so nothing is overdue.
export type LoanForOverdue = { status: 'ACTIVE' | 'RETURNED'; dueAt: Date };

export function isOverdue(_loan: LoanForOverdue, _now: Date): boolean {
  return false;
}
