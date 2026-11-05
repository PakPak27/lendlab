import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, toErrorBody } from '../lib/errors.js';

// Unknown /api routes -> 404 in the standard error shape.
export function apiNotFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
}

// Central error handler (NFR-11): one JSON shape, never a stack trace in the response.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json(toErrorBody(err));
  }

  // Malformed JSON body sent by the client.
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' },
    });
  }

  // A unique constraint violation that a service did not map itself.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'ITEM_NOT_AVAILABLE', message: 'The operation conflicts with existing data.' },
    });
  }

  // Unexpected error: log details on the server only.
  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
