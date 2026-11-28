// CHG-01 (Issue #50), TEST-04-13 / AC-04-08: BR-04 v0.3 maximum loan length per category.
import { describe, expect, it } from 'vitest';
import { loanLengthError } from '../../src/lib/loanLength.js';

const laptop = { name: 'Laptop', maxLoanDays: 7 };
const camera = { name: 'Camera', maxLoanDays: 3 };
const kit = { name: 'Microcontroller Kit', maxLoanDays: 14 };

describe('loanLengthError (BR-04 v0.3)', () => {
  it.each([
    [1, laptop],
    [7, laptop],
    [3, camera],
    [14, kit],
  ])('accepts %i days for %o', (days, category) => {
    expect(loanLengthError(days, category)).toBeNull();
  });

  it.each([
    [8, laptop, 'Loan length for Laptop items must be 1–7 days.'],
    [4, camera, 'Loan length for Camera items must be 1–3 days.'],
  ])('rejects %i days for %o', (days, category, message) => {
    expect(loanLengthError(days, category)).toBe(message);
  });
});
