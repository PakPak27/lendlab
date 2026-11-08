// F-02 TEST-02-07 (AC-02-02, AC-02-03): requireRole lets the right role through and stops everyone else.
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { requireRole } from '../../src/middleware/requireRole.js';

const reqWith = (role?: 'BORROWER' | 'CUSTODIAN') =>
  ({ user: role ? { id: 1, email: 'x@lendlab.test', name: 'X', role, locationIds: [] } : undefined }) as Request;

function run(role?: 'BORROWER' | 'CUSTODIAN', allowed: Array<'BORROWER' | 'CUSTODIAN'> = ['CUSTODIAN']) {
  const next = vi.fn();
  requireRole(...allowed)(reqWith(role), {} as Response, next);
  return next;
}

describe('requireRole', () => {
  it('calls next() with no error when the role is allowed', () => {
    const next = run('CUSTODIAN');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('answers 403 FORBIDDEN when the signed-in role is not allowed', () => {
    const next = run('BORROWER');
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  });

  it('answers 401 UNAUTHENTICATED when nobody is signed in', () => {
    const err = run(undefined).mock.calls[0][0];
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('accepts any of several listed roles', () => {
    expect(run('BORROWER', ['BORROWER', 'CUSTODIAN'])).toHaveBeenCalledWith();
  });
});
