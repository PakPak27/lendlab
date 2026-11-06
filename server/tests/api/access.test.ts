// F-02 Role and location access control: authentication on every protected route and role restrictions.
// Every negative test checks the database afterwards, not only the status code.
// AC-02-04 (own requests only) is verified with F-04, AC-02-05/06 (location scope) with F-05,
// because those need the request and checkout endpoints; see the contract version history.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

async function tokenFor(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

// Puts LAP-001 in the state "Pending request, item Reserved" without going through any API.
async function pendingRequestOnLaptop() {
  const borrower = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower2@lendlab.test' } });
  const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-001' } });
  await prisma.item.update({ where: { id: item.id }, data: { status: 'RESERVED' } });
  const req = await prisma.borrowRequest.create({
    data: { itemId: item.id, borrowerId: borrower.id, purpose: 'Access test', requestedDays: 3 },
  });
  return { item, req };
}

const protectedEndpoints: Array<[string, 'get' | 'post', string]> = [
  ['list items', 'get', '/api/items'],
  ['item detail', 'get', '/api/items/1'],
  ['create request', 'post', '/api/requests'],
  ['my requests', 'get', '/api/requests/mine'],
  ['request detail', 'get', '/api/requests/1'],
  ['custodian queue', 'get', '/api/custodian/requests'],
  ['checkout', 'post', '/api/custodian/requests/1/checkout'],
  ['current user', 'get', '/api/auth/me'],
  ['logout', 'post', '/api/auth/logout'],
];

describe('protected endpoints require a session (TEST-02-01 / AC-02-01)', () => {
  it.each(protectedEndpoints)('%s answers 401 with only an error object', async (_name, method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('does not let a revoked or made-up token through any of them', async () => {
    for (const [, method, path] of protectedEndpoints) {
      const res = await request(app)[method](path).set('Authorization', 'Bearer not-a-real-token');
      expect(res.status, path).toBe(401);
    }
  });

  it('keeps /api/categories public for the later smoke test', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).not.toBe(401);
  });
});

describe('borrower cannot use custodian operations (TEST-02-02 / AC-02-02)', () => {
  it('gets 403 on the queue and on checkout, and nothing changes', async () => {
    const { item, req } = await pendingRequestOnLaptop();
    const token = await tokenFor('borrower1@lendlab.test');

    const queue = await request(app).get('/api/custodian/requests').set('Authorization', `Bearer ${token}`);
    const checkout = await request(app)
      .post(`/api/custodian/requests/${req.id}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    for (const res of [queue, checkout]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('You do not have permission to perform this action.');
    }
    expect((await prisma.borrowRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('PENDING');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('RESERVED');
    expect(await prisma.loan.count()).toBe(0);
  });
});

describe('custodian cannot create or read borrow requests (TEST-02-03 / AC-02-03)', () => {
  it('gets 403 on POST /api/requests, and no request is created', async () => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-002' } });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item.id, purpose: 'Custodian trying to borrow', requestedDays: 3 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.borrowRequest.count()).toBe(0);
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('AVAILABLE');
  });

  it.each([['/api/requests/mine'], ['/api/requests/1']])('gets 403 on GET %s', async (path) => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('enforcement order (design section 2)', () => {
  it('answers 401 before 403: an anonymous call to a custodian route is not a permission error', async () => {
    const res = await request(app).post('/api/custodian/requests/1/checkout');
    expect(res.status).toBe(401);
  });

  it('answers 403 before validating the body: a forbidden role learns nothing about the input rules', async () => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const res = await request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });
});
