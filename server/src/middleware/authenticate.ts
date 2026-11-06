import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { hashToken, isSessionValid } from '../lib/session.js';
import { toAuthUser, type AuthUser } from '../services/authService.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    sessionId?: number;
  }
}

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'You must sign in to continue.');

// Reads "Authorization: Bearer <token>" and returns the token, or null if the header is missing or malformed.
function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match ? match[1] : null;
}

// NFR-02: every protected route mounts this. It attaches req.user = { id, role, locationIds }
// and req.sessionId, or rejects with 401 and no data. The user comes from the server-side
// session, never from anything the client chooses.
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req.header('authorization'));
    if (!token) throw unauthenticated();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { locations: { select: { locationId: true } } } } },
    });

    if (!session || !isSessionValid(session) || !session.user.isActive) {
      throw unauthenticated();
    }

    req.user = toAuthUser(session.user);
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}
