// Lab 5 C-02 (R-06): a deliberately failing test on a temporary branch, to show
// that the required check `test-and-docker` fails and blocks the merge into main.
// This branch is never merged; the PR is closed after the screenshot.
import { describe, expect, it } from 'vitest';
import { computeDueDate } from '../../src/lib/dates.js';

describe('C-02 temporary failing check', () => {
  it('expects a 7-day loan to be due after 8 days (wrong on purpose)', () => {
    const due = computeDueDate(new Date('2026-11-28T10:00:00.000Z'), 7);
    expect(due.toISOString()).toBe('2026-12-06T10:00:00.000Z');
  });
});
