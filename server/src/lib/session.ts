import { createHash, randomBytes } from 'node:crypto';

// A session token is 32 random bytes, base64url encoded (43 characters).
// Only its SHA-256 hash is stored, so a leaked database does not leak usable tokens.
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionTimes {
  expiresAt: Date;
  revokedAt: Date | null;
}

// Only a session that is neither revoked nor expired authenticates (NFR-04).
export function isSessionValid(session: SessionTimes, now: Date = new Date()): boolean {
  return session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
}
