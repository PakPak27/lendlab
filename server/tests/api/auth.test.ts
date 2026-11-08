// F-01 Authentication and Session: login, current user, logout (TEST-01-01 .. TEST-01-09).
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { verifyPassword } from '../../src/lib/password.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

async function tokenFor(email: string) {
  const res = await login(email, TEST_PASSWORD);
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials (TEST-01-01 / AC-01-01)', async () => {
    const res = await login('borrower1@lendlab.test', TEST_PASSWORD);

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user).toMatchObject({
      email: 'borrower1@lendlab.test',
      name: 'Borrower One',
      role: 'BORROWER',
      locationIds: [],
    });
    expect(typeof res.body.user.id).toBe('number');
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns the assigned location ids for a custodian', async () => {
    const res = await login('custodian.hw@lendlab.test', TEST_PASSWORD);
    const hw = await prisma.location.findUniqueOrThrow({ where: { code: 'HW-LAB' } });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('CUSTODIAN');
    expect(res.body.user.locationIds).toEqual([hw.id]);
  });

  it('stores a hashed token, not the token itself, and a bounded expiry (NFR-04)', async () => {
    const before = Date.now();
    const res = await login('borrower1@lendlab.test', TEST_PASSWORD);
    const session = await prisma.session.findFirstOrThrow();

    expect(session.tokenHash).not.toBe(res.body.token);
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const hours = (session.expiresAt.getTime() - before) / 3_600_000;
    expect(hours).toBeGreaterThan(7.9);
    expect(hours).toBeLessThanOrEqual(8.01);
    expect(session.revokedAt).toBeNull();
  });

  it('rejects a wrong password and creates no session (TEST-01-02 / AC-01-02)', async () => {
    const res = await login('borrower1@lendlab.test', 'wrong');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.token).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it('rejects an unknown e-mail with the same message (TEST-01-03 / AC-01-02)', async () => {
    const wrongPassword = await login('borrower1@lendlab.test', 'wrong');
    const unknownEmail = await login('nobody@lendlab.test', 'wrong');

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
    expect(unknownEmail.body.error.message).toBe('Invalid e-mail or password.');
    expect(await prisma.session.count()).toBe(0);
  });

  it('treats the e-mail case-insensitively and ignores surrounding spaces', async () => {
    const res = await login('  Borrower1@LendLab.test ', TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('borrower1@lendlab.test');
  });

  const invalidInputs: Array<[string, unknown, string]> = [
    ['empty body', {}, 'email'],
    ['malformed e-mail', { email: 'abc', password: 'x' }, 'email'],
    ['empty password', { email: 'a@b.co', password: '' }, 'password'],
    ['missing password', { email: 'borrower1@lendlab.test' }, 'password'],
    ['73-character password', { email: 'a@b.co', password: 'a'.repeat(73) }, 'password'],
    ['25 Thai characters (75 bytes)', { email: 'a@b.co', password: 'ก'.repeat(25) }, 'password'],
    ['e-mail longer than 254 characters', { email: `${'a'.repeat(250)}@b.co`, password: 'x' }, 'email'],
    ['non-string password', { email: 'a@b.co', password: 12345678 }, 'password'],
  ];

  it.each(invalidInputs)('validates login input: %s (TEST-01-04 / AC-01-03)', async (_name, body, field) => {
    const res = await request(app).post('/api/auth/login').send(body as object);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(await prisma.session.count()).toBe(0);
  });

  it('accepts a 72-byte password at the boundary', async () => {
    const res = await login('borrower1@lendlab.test', 'a'.repeat(72));
    expect(res.status).toBe(401); // valid input, wrong password: not a 400
  });

  it('inactive user cannot log in (TEST-01-09 / AC-01-07)', async () => {
    await prisma.user.update({ where: { email: 'borrower1@lendlab.test' }, data: { isActive: false } });

    const res = await login('borrower1@lendlab.test', TEST_PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('seeded passwords (AC-01-06)', () => {
  it('are bcrypt hashes that differ from the plaintext and verify correctly', async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user.passwordHash).not.toBe(TEST_PASSWORD);
      expect(user.passwordHash.startsWith('$2')).toBe(true);
      expect(await verifyPassword(TEST_PASSWORD, user.passwordHash)).toBe(true);
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns the user for a valid token (TEST-01-05a)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'borrower1@lendlab.test', role: 'BORROWER', locationIds: [] });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it.each([['bearer'], ['BEARER'], ['Bearer']])('accepts the %s scheme in any letter case (RFC 7235)', async (scheme) => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `${scheme} ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('borrower1@lendlab.test');
  });

  it('rejects a request with no Authorization header (TEST-01-05b)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.user).toBeUndefined();
  });

  it.each([['Bearer xyz'], ['xyz'], ['Basic abc'], ['Bearer'], ['Bearer ']])(
    'rejects a malformed or unknown token %j (TEST-01-05c)',
    async (header) => {
      const res = await request(app).get('/api/auth/me').set('Authorization', header);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.user).toBeUndefined();
    },
  );

  it('rejects a token whose session has expired (TEST-01-05d)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.user).toBeUndefined();
  });

  it('rejects a valid token once the user has been deactivated', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    await prisma.user.update({ where: { email: 'borrower1@lendlab.test' }, data: { isActive: false } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the token on the server (TEST-01-06 / AC-01-05)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');

    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHENTICATED');

    const session = await prisma.session.findFirstOrThrow();
    expect(session.revokedAt).not.toBeNull();
  });

  it('only revokes the calling session, not the user\'s other sessions', async () => {
    const first = await tokenFor('borrower1@lendlab.test');
    const second = await tokenFor('borrower1@lendlab.test');

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first}`);

    const stillValid = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second}`);
    expect(stillValid.status).toBe(200);
  });

  it('requires a session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
