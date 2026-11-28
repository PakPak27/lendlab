// F-09 (Sprint 2), TEST-09-01 / AC-09-01: BR-08 at most 3 open commitments.
import { describe, expect, it } from 'vitest';
import { BORROWING_LIMIT, limitReached } from '../../src/lib/borrowingLimit.js';

describe('limitReached (BR-08)', () => {
  it('uses a limit of 3', () => {
    expect(BORROWING_LIMIT).toBe(3);
  });

  it.each([
    [0, false],
    [1, false],
    [2, false],
    [3, true],
    [4, true],
  ])('%i open commitments -> limit reached: %s', (open, expected) => {
    expect(limitReached(open)).toBe(expected);
  });
});
