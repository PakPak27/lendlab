// F-01 TEST-01-07 (AC-01-04): only a session that is neither revoked nor expired authenticates.
import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, isSessionValid } from '../../src/lib/session.js';

describe('isSessionValid', () => {
  const now = new Date('2026-11-06T10:00:00.000Z');
  const inFuture = (ms: number) => new Date(now.getTime() + ms);

  it('accepts a session that expires in 1 second and is not revoked', () => {
    expect(isSessionValid({ expiresAt: inFuture(1000), revokedAt: null }, now)).toBe(true);
  });

  it('rejects a revoked session even if it has not expired', () => {
    expect(isSessionValid({ expiresAt: inFuture(60_000), revokedAt: new Date('2026-11-06T09:00:00.000Z') }, now)).toBe(false);
  });

  it('rejects a session that expired 1 second ago', () => {
    expect(isSessionValid({ expiresAt: inFuture(-1000), revokedAt: null }, now)).toBe(false);
  });

  it('rejects a session that expires exactly now', () => {
    expect(isSessionValid({ expiresAt: now, revokedAt: null }, now)).toBe(false);
  });
});

describe('session tokens', () => {
  it('generates 32 random bytes as base64url (43 characters), different each time', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('stores only a SHA-256 hash of the token, never the token itself', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken(token)).toBe(hash);
  });
});
