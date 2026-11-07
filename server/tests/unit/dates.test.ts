// F-05 TEST-05-09 (AC-05-02, BR-04): due date = checkout time + requested days x 24 h.
import { describe, expect, it } from 'vitest';
import { computeDueDate } from '../../src/lib/dates.js';

describe('computeDueDate', () => {
  it.each([
    ['2026-11-28T10:00:00.000Z', 7, '2026-12-05T10:00:00.000Z'],
    ['2026-11-07T00:00:00.000Z', 1, '2026-11-08T00:00:00.000Z'],
    ['2026-11-07T03:20:00.000Z', 14, '2026-11-21T03:20:00.000Z'],
  ])('%s + %i days = %s', (checkedOutAt, days, expected) => {
    expect(computeDueDate(new Date(checkedOutAt), days).toISOString()).toBe(expected);
  });

  it('is exactly days x 86 400 000 ms and does not change the input date', () => {
    const start = new Date('2026-01-31T23:59:59.000Z');
    const due = computeDueDate(start, 3);
    expect(due.getTime() - start.getTime()).toBe(3 * 86_400_000);
    expect(start.toISOString()).toBe('2026-01-31T23:59:59.000Z');
  });
});
