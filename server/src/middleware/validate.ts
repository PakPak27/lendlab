import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { validationError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

// Validates req[source] with a Zod schema and replaces it with the parsed value.
// On failure responds 400 VALIDATION_ERROR with one detail per invalid field.
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(validationError(details));
    }
    // Express 4 allows reassigning these properties.
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
