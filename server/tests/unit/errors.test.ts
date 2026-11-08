// SYS-01 / NFR-11: every API error uses one JSON shape.
import { describe, expect, it } from 'vitest';
import { AppError, toErrorBody, validationError } from '../../src/lib/errors.js';

describe('toErrorBody', () => {
  it('produces { error: { code, message } } without details when there are none', () => {
    const body = toErrorBody(new AppError(409, 'ITEM_NOT_AVAILABLE', 'This item is not available to request.'));
    expect(body).toEqual({
      error: { code: 'ITEM_NOT_AVAILABLE', message: 'This item is not available to request.' },
    });
  });

  it('includes field details for validation errors', () => {
    const err = validationError([{ field: 'requestedDays', message: 'Must be at most 14' }]);
    expect(err.status).toBe(400);
    expect(toErrorBody(err)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid.',
        details: [{ field: 'requestedDays', message: 'Must be at most 14' }],
      },
    });
  });
});
