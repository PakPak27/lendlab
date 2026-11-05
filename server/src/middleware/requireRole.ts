import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../lib/errors.js';

// BR-07: role restriction, enforced on the backend. Mount after `authenticate`.
// No user -> 401 (defensive: authenticate should already have rejected the request).
// Signed-in but wrong role -> 403 and the handler never runs, so nothing is changed.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'You must sign in to continue.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    next();
  };
}
