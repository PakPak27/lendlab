// Standard API error (NFR-11). Every error response has the shape:
// { "error": { "code": "...", "message": "...", "details": [...] } }

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_NOT_AVAILABLE'
  | 'REQUEST_NOT_PENDING'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toErrorBody(err: AppError) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
    },
  };
}

// Helpers used by routes and services.
export const notFound = (message = 'The requested resource was not found.') =>
  new AppError(404, 'NOT_FOUND', message);

export const validationError = (details: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', details);
