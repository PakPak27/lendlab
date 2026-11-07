// F-05 Request queue and checkout (TEST-05-01 .. TEST-05-05, TEST-05-07) plus the location-scope
// tests that belong to F-02 but need these endpoints (TEST-02-05, TEST-02-06).
// Every negative test checks the database afterwards.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';
import { createPendingRequest } from '../helpers/requests.js';

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

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('GET /api/custodian/requests (queue)', () => {
  it('lists pending requests oldest first with borrower, item, purpose and days (TEST-05-01 / AC-05-01)', async () => {
    const newer = await createPendingRequest({ assetTag: 'LAP-002', createdAt: new Date('2026-11-06T10:01:00Z'), borrowerEmail: 'borrower2@lendlab.test' });
    const older = await createPendingRequest({ assetTag: 'LAP-001', createdAt: new Date('2026-11-06T10:00:00Z'), requestedDays: 5 });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const res = await request(app).get('/api/custodian/requests').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.requests.map((r: { id: number }) => r.id)).toEqual([older.request.id, newer.request.id]);
    expect(res.body.requests[0]).toMatchObject({
      status: 'PENDING',
      purpose: 'Embedded systems lab assignment',
      requestedDays: 5,
      borrower: { name: 'Borrower One', email: 'borrower1@lendlab.test' },
      item: { assetTag: 'LAP-001', name: 'Dell Latitude 5440', location: { code: 'HW-LAB' } },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns an empty list when nothing is pending', async () => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const res = await request(app).get('/api/custodian/requests').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requests: [] });
  });

  it('shows only requests for the custodian\'s own locations (TEST-02-05 / AC-02-05)', async () => {
    const hw = await createPendingRequest({ assetTag: 'LAP-001' });
    const media = await createPendingRequest({ assetTag: 'CAM-001' });

    const hwList = await request(app).get('/api/custodian/requests').set(bearer(await tokenFor('custodian.hw@lendlab.test')));
    const mediaList = await request(app).get('/api/custodian/requests').set(bearer(await tokenFor('custodian.media@lendlab.test')));

    expect(hwList.body.requests.map((r: { id: number }) => r.id)).toEqual([hw.request.id]);
    expect(mediaList.body.requests.map((r: { id: number }) => r.id)).toEqual([media.request.id]);
  });

  it('does not list requests that are no longer pending', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    await prisma.borrowRequest.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    const res = await request(app).get('/api/custodian/requests').set(bearer(await tokenFor('custodian.hw@lendlab.test')));
    expect(res.body.requests).toEqual([]);
  });

  it('supports status=PENDING and rejects any other status with 400', async () => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const ok = await request(app).get('/api/custodian/requests?status=PENDING').set(bearer(token));
    const bad = await request(app).get('/api/custodian/requests?status=FULFILLED').set(bearer(token));

    expect(ok.status).toBe(200);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/custodian/requests/:id/checkout', () => {
  it('checks out a pending request: loan, due date, request and item states (TEST-05-02 / AC-05-02)', async () => {
    const { request: r, item, borrower } = await createPendingRequest({ assetTag: 'LAP-001', requestedDays: 7 });
    const custodian = await prisma.user.findUniqueOrThrow({ where: { email: 'custodian.hw@lendlab.test' } });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const res = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    expect(res.status).toBe(201);
    const { loan } = res.body;
    expect(loan).toMatchObject({
      status: 'ACTIVE',
      requestId: r.id,
      item: { id: item.id, assetTag: 'LAP-001', status: 'ON_LOAN' },
      borrower: { id: borrower.id, name: 'Borrower One' },
    });
    expect(new Date(loan.dueAt).getTime() - new Date(loan.checkedOutAt).getTime()).toBe(7 * 86_400_000);

    const row = await prisma.borrowRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe('FULFILLED');
    expect(row.decidedById).toBe(custodian.id);
    expect(row.decidedAt).not.toBeNull();
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('ON_LOAN');
    const loans = await prisma.loan.findMany();
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ status: 'ACTIVE', itemId: item.id, borrowerId: borrower.id, checkedOutById: custodian.id });
  });

  it('removes the request from the queue afterwards', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    const token = await tokenFor('custodian.hw@lendlab.test');
    await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    const queue = await request(app).get('/api/custodian/requests').set(bearer(token));
    expect(queue.body.requests).toEqual([]);
  });

  it('cannot check out twice: 409 REQUEST_NOT_PENDING and still exactly one loan (TEST-05-03 / AC-05-03)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    const token = await tokenFor('custodian.hw@lendlab.test');
    await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    const again = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REQUEST_NOT_PENDING');
    expect(await prisma.loan.count({ where: { requestId: r.id } })).toBe(1);
  });

  it('two checkouts at the same moment create exactly one loan (TEST-05-04 / AC-05-04)', async () => {
    const { request: r, item } = await createPendingRequest({ assetTag: 'LAP-001' });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const results = await Promise.all([
      request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token)),
      request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token)),
    ]);

    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await prisma.loan.count({ where: { itemId: item.id } })).toBe(1);
    expect(await prisma.loan.count({ where: { itemId: item.id, status: 'ACTIVE' } })).toBe(1);
  });

  it('item no longer reserved: 409 ITEM_NOT_AVAILABLE, request stays pending, no loan (TEST-05-05 / AC-05-05)', async () => {
    const { request: r, item } = await createPendingRequest({ assetTag: 'LAP-001' });
    await prisma.item.update({ where: { id: item.id }, data: { status: 'MAINTENANCE' } });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const res = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_NOT_AVAILABLE');
    expect((await prisma.borrowRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('PENDING');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('MAINTENANCE');
    expect(await prisma.loan.count()).toBe(0);
  });

  it('a request that was cancelled cannot be checked out', async () => {
    const { request: r, item } = await createPendingRequest({ assetTag: 'LAP-001' });
    await prisma.borrowRequest.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const res = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REQUEST_NOT_PENDING');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('RESERVED');
    expect(await prisma.loan.count()).toBe(0);
  });

  it('cannot check out another location\'s request: 404, nothing changes (TEST-02-06 / AC-02-06)', async () => {
    const { request: r, item } = await createPendingRequest({ assetTag: 'CAM-001' });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const res = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect((await prisma.borrowRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('PENDING');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('RESERVED');
    expect(await prisma.loan.count()).toBe(0);
  });

  it('an unknown request id is 404', async () => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const res = await request(app).post('/api/custodian/requests/99999/checkout').set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([['abc'], ['0'], ['-3'], ['1.5'], ['99999999999'], ['1e3'], ['%205'], ['007']])('rejects the id %s with 400', async (id) => {
    const token = await tokenFor('custodian.hw@lendlab.test');
    const res = await request(app).post(`/api/custodian/requests/${id}/checkout`).set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('what the borrower sees after checkout (TEST-05-07 / AC-05-06)', () => {
  it('GET /api/requests/mine shows the request as FULFILLED with an ACTIVE loan and the same due date', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001', requestedDays: 3 });
    const custodianToken = await tokenFor('custodian.hw@lendlab.test');
    const checkout = await request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(custodianToken));
    expect(checkout.status).toBe(201);

    const borrowerToken = await tokenFor('borrower1@lendlab.test');
    const mine = await request(app).get('/api/requests/mine').set(bearer(borrowerToken));

    expect(mine.status).toBe(200);
    const seen = mine.body.requests.find((x: { id: number }) => x.id === r.id);
    expect(seen.status).toBe('FULFILLED');
    expect(seen.loan.status).toBe('ACTIVE');
    expect(seen.loan.dueAt).toBe(checkout.body.loan.dueAt);
    expect(seen.item.status).toBe('ON_LOAN');
  });
});
