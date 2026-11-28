// F-08 (Sprint 2), TEST-08-01 / AC-08-01: BR-11 a loan is overdue when it is Active and now is after its due date.
import { describe, expect, it } from 'vitest';
import { isOverdue } from '../../src/lib/overdue.js';

const now = new Date('2026-11-28T12:00:00.000Z');
const due = (ms: number) => new Date(now.getTime() + ms);

describe('isOverdue (BR-11)', () => {
  it.each([
    ['Active, due tomorrow', 'ACTIVE', due(86_400_000), false],
    ['Active, due exactly now', 'ACTIVE', due(0), false],
    ['Active, due 1 ms ago', 'ACTIVE', due(-1), true],
    ['Active, due 3 days ago', 'ACTIVE', due(-3 * 86_400_000), true],
    ['Returned, due 3 days ago', 'RETURNED', due(-3 * 86_400_000), false],
  ] as const)('%s -> %s', (_name, status, dueAt, expected) => {
    expect(isOverdue({ status, dueAt }, now)).toBe(expected);
  });
});
