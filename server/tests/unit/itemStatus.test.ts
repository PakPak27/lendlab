// F-10 (Sprint 2), TEST-10-01 / AC-10-05: BR-13 allowed manual status changes (contract section 2 table).
import { describe, expect, it } from 'vitest';
import { statusChangeError } from '../../src/lib/itemStatus.js';

describe('statusChangeError (BR-13)', () => {
  it.each([
    ['AVAILABLE', 'AVAILABLE', 'INVALID_STATUS_CHANGE'],
    ['AVAILABLE', 'MAINTENANCE', null],
    ['AVAILABLE', 'RETIRED', null],
    ['MAINTENANCE', 'AVAILABLE', null],
    ['MAINTENANCE', 'MAINTENANCE', 'INVALID_STATUS_CHANGE'],
    ['MAINTENANCE', 'RETIRED', null],
    ['RESERVED', 'AVAILABLE', 'ITEM_IN_USE'],
    ['RESERVED', 'MAINTENANCE', 'ITEM_IN_USE'],
    ['RESERVED', 'RETIRED', 'ITEM_IN_USE'],
    ['ON_LOAN', 'AVAILABLE', 'ITEM_IN_USE'],
    ['ON_LOAN', 'MAINTENANCE', 'ITEM_IN_USE'],
    ['ON_LOAN', 'RETIRED', 'ITEM_IN_USE'],
    ['RETIRED', 'AVAILABLE', 'ITEM_RETIRED'],
    ['RETIRED', 'MAINTENANCE', 'ITEM_RETIRED'],
    ['RETIRED', 'RETIRED', 'ITEM_RETIRED'],
  ] as const)('%s -> %s: %s', (from, to, expected) => {
    expect(statusChangeError(from, to)).toBe(expected);
  });
});
