// F-04 input rules as pure validation (TEST-04-05, TEST-04-07 unit part / AC-04-04).
import { describe, expect, it } from 'vitest';
import { createRequestSchema } from '../../src/schemas/requestSchemas.js';

const base = { itemId: 1, purpose: 'Embedded systems lab', requestedDays: 7 };
const ok = (overrides: Record<string, unknown>) => createRequestSchema.safeParse({ ...base, ...overrides }).success;

describe('createRequestSchema — loan length (BR-04, TEST-04-05)', () => {
  it.each([
    [0, false],
    [1, true],
    [14, true],
    [15, false],
    [2.5, false],
    ['7', false],
    [-3, false],
  ])('requestedDays %j -> valid: %s', (days, expected) => {
    expect(ok({ requestedDays: days })).toBe(expected);
  });
});

describe('createRequestSchema — purpose (BR-14, TEST-04-07)', () => {
  it.each([
    ['4 characters', 'a'.repeat(4), false],
    ['5 characters', 'a'.repeat(5), true],
    ['200 characters', 'a'.repeat(200), true],
    ['201 characters', 'a'.repeat(201), false],
    ['only spaces', '     ', false],
    ['5 characters with surrounding spaces', '   abcde   ', true],
    ['4 characters with surrounding spaces', '   abcd   ', false],
  ])('%s -> valid: %s', (_name, purpose, expected) => {
    expect(ok({ purpose })).toBe(expected);
  });

  it('trims the purpose', () => {
    const parsed = createRequestSchema.parse({ ...base, purpose: '  Thesis demo  ' });
    expect(parsed.purpose).toBe('Thesis demo');
  });
});

describe('createRequestSchema — item id', () => {
  it.each([
    [1, true],
    [0, false],
    [-1, false],
    [1.5, false],
    ['1', false],
  ])('itemId %j -> valid: %s', (itemId, expected) => {
    expect(ok({ itemId })).toBe(expected);
  });
});
