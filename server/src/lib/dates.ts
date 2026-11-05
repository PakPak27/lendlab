// BR-04: the due date is the checkout time plus the requested number of days (days x 24 h).
export function computeDueDate(checkedOutAt: Date, days: number): Date {
  return new Date(checkedOutAt.getTime() + days * 24 * 60 * 60 * 1000);
}
