// NFR-11: the central error handler always returns the standard shape and the right status.
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { isUniqueViolation } from '../../src/lib/prismaErrors.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function p2002(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target },
  });
}

function run(err: unknown) {
  const res = mockRes();
  errorHandler(err, {} as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe('errorHandler', () => {
  it('uses the status and code of an AppError', () => {
    const { status, body } = run(new AppError(409, 'REQUEST_NOT_PENDING', 'Request is not pending.'));
    expect(status).toBe(409);
    expect(body).toEqual({ error: { code: 'REQUEST_NOT_PENDING', message: 'Request is not pending.' } });
  });

  it('maps an unhandled unique violation to a generic 409 CONFLICT, not a business-rule code', () => {
    const { status, body } = run(p2002(['assetTag']));
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('hides unexpected errors behind 500 INTERNAL_ERROR without a stack trace', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = run(new Error('database exploded at /secret/path.ts:12'));
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  });
});

describe('isUniqueViolation', () => {
  it('matches the violated field or index name', () => {
    const err = p2002(['requestId']);
    expect(isUniqueViolation(err)).toBe(true);
    expect(isUniqueViolation(err, 'requestId')).toBe(true);
    expect(isUniqueViolation(err, 'assetTag')).toBe(false);
  });

  it('is false for other errors', () => {
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(new AppError(409, 'CONFLICT', 'x'))).toBe(false);
  });
});
