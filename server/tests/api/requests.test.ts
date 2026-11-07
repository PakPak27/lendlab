// F-04 Borrow Request and My Borrowing (TEST-04-01 .. TEST-04-10) and TEST-02-04 from F-02,
// which needs GET /api/requests/:id (see F-02 contract v0.2).
// Every negative test also checks that the database did not change.
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

const itemId = async (assetTag: string) => (await prisma.item.findUniqueOrThrow({ where: { assetTag } })).id;
const itemStatus = async (assetTag: string) =>
  (await prisma.item.findUniqueOrThrow({ where: { assetTag } })).status;

function post(token: string, body: unknown) {
  return request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send(body as object);
}

const valid = (id: number, overrides: Record<string, unknown> = {}) => ({
  itemId: id,
  purpose: 'Embedded systems lab assignment 3',
  requestedDays: 7,
  ...overrides,
});

describe('POST /api/requests — create and reserve', () => {
  it('creates a request and reserves the item (TEST-04-01 / AC-04-01)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const lap1 = await itemId('LAP-001');

    const res = await post(token, valid(lap1));

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({
      id: expect.any(Number),
      status: 'PENDING',
      purpose: 'Embedded systems lab assignment 3',
      requestedDays: 7,
      createdAt: expect.any(String),
      item: { id: lap1, assetTag: 'LAP-001', name: 'Dell Latitude 5440', status: 'RESERVED' },
      loan: null,
    });
    expect(await itemStatus('LAP-001')).toBe('RESERVED');

    const mine = await request(app).get('/api/requests/mine').set('Authorization', `Bearer ${token}`);
    expect(mine.body.requests.map((r: { id: number }) => r.id)).toContain(res.body.request.id);
  });

  it('stores the purpose trimmed and links the request to the signed-in borrower', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(await itemId('LAP-002'), { purpose: '   Thesis demo video   ' }));

    expect(res.status).toBe(201);
    const row = await prisma.borrowRequest.findUniqueOrThrow({
      where: { id: res.body.request.id },
      include: { borrower: true },
    });
    expect(row.purpose).toBe('Thesis demo video');
    expect(row.borrower.email).toBe('borrower1@lendlab.test');
  });

  it('ignores a borrowerId sent by the client (the server decides who the borrower is)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const borrower2 = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower2@lendlab.test' } });

    const res = await post(token, { ...valid(await itemId('CAM-001')), borrowerId: borrower2.id });

    expect(res.status).toBe(201);
    const row = await prisma.borrowRequest.findUniqueOrThrow({ where: { id: res.body.request.id } });
    expect(row.borrowerId).not.toBe(borrower2.id);
  });
});

describe('BR-01 only Available items can be requested (TEST-04-02 / AC-04-02)', () => {
  it.each([['RESERVED'], ['ON_LOAN'], ['MAINTENANCE'], ['RETIRED']] as const)(
    'rejects an item that is %s with 409 and changes nothing',
    async (status) => {
      const token = await tokenFor('borrower1@lendlab.test');
      await prisma.item.update({ where: { assetTag: 'PRJ-001' }, data: { status } });

      const res = await post(token, valid(await itemId('PRJ-001')));

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'ITEM_NOT_AVAILABLE',
        message: 'This item is not available to request.',
      });
      expect(await prisma.borrowRequest.count()).toBe(0);
      expect(await itemStatus('PRJ-001')).toBe(status);
    },
  );

  it('rejects the seeded Maintenance item ARD-003 (demo case)', async () => {
    const token = await tokenFor('borrower2@lendlab.test');
    const res = await post(token, valid(await itemId('ARD-003')));

    expect(res.status).toBe(409);
    expect(await itemStatus('ARD-003')).toBe('MAINTENANCE');
  });

  it('rejects a second request for an item that is already reserved by someone else', async () => {
    const lap1 = await itemId('LAP-001');
    expect((await post(await tokenFor('borrower1@lendlab.test'), valid(lap1))).status).toBe(201);

    const second = await post(await tokenFor('borrower2@lendlab.test'), valid(lap1));

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ITEM_NOT_AVAILABLE');
    expect(await prisma.borrowRequest.count({ where: { itemId: lap1 } })).toBe(1);
  });
});

describe('BR-02 concurrency (TEST-04-03 / AC-04-03, NFR-05)', () => {
  it('only one of two concurrent requests for the same item succeeds', async () => {
    const [t1, t2] = await Promise.all([
      tokenFor('borrower1@lendlab.test'),
      tokenFor('borrower2@lendlab.test'),
    ]);
    const lap2 = await itemId('LAP-002');

    const results = await Promise.all([post(t1, valid(lap2)), post(t2, valid(lap2))]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.borrowRequest.count({ where: { itemId: lap2, status: 'PENDING' } })).toBe(1);
    expect(await itemStatus('LAP-002')).toBe('RESERVED');
  });

  it('stays correct under five concurrent requests', async () => {
    const t1 = await tokenFor('borrower1@lendlab.test');
    const t2 = await tokenFor('borrower2@lendlab.test');
    const cam2 = await itemId('CAM-002');

    const results = await Promise.all([t1, t2, t1, t2, t1].map((t) => post(t, valid(cam2))));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.borrowRequest.count({ where: { itemId: cam2 } })).toBe(1);
  });
});

describe('input validation (TEST-04-06 .. TEST-04-08 / AC-04-04)', () => {
  it.each([
    [0, 400],
    [1, 201],
    [14, 201],
    [15, 400],
  ])('loan length %i days -> %i (TEST-04-06)', async (days, expected) => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(await itemId('ARD-001'), { requestedDays: days }));

    expect(res.status).toBe(expected);
    if (expected === 400) {
      expect(res.body.error.details[0].field).toBe('requestedDays');
      expect(await itemStatus('ARD-001')).toBe('AVAILABLE');
    }
  });

  it.each([[2.5], ['7'], [null]])('rejects requestedDays = %j with 400', async (days) => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(await itemId('ARD-002'), { requestedDays: days }));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('requestedDays');
  });

  it('rejects a short purpose with field "purpose" and reserves nothing (TEST-04-07)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(await itemId('LAP-003'), { purpose: 'abcd' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('purpose');
    expect(await prisma.borrowRequest.count()).toBe(0);
    expect(await itemStatus('LAP-003')).toBe('AVAILABLE');
  });

  it('rejects a purpose of only spaces', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(await itemId('LAP-003'), { purpose: '        ' }));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('purpose');
  });

  it('answers 404 ITEM_NOT_FOUND for an unknown item (TEST-04-08)', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, valid(99999));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    expect(await prisma.borrowRequest.count()).toBe(0);
  });

  it('rejects a missing body field with 400', async () => {
    const token = await tokenFor('borrower1@lendlab.test');
    const res = await post(token, { purpose: 'No item given here', requestedDays: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('itemId');
  });
});

describe('GET /api/requests/mine (TEST-04-09 / AC-04-05)', () => {
  it('returns only the caller\'s requests, newest first, with loan null', async () => {
    const t1 = await tokenFor('borrower1@lendlab.test');
    const t2 = await tokenFor('borrower2@lendlab.test');
    const first = await post(t1, valid(await itemId('LAP-001')));
    const second = await post(t1, valid(await itemId('CAM-001')));
    await post(t2, valid(await itemId('PRJ-001')));

    const res = await request(app).get('/api/requests/mine').set('Authorization', `Bearer ${t1}`);

    expect(res.status).toBe(200);
    expect(res.body.requests.map((r: { id: number }) => r.id)).toEqual([
      second.body.request.id,
      first.body.request.id,
    ]);
    for (const r of res.body.requests) {
      expect(r.loan).toBeNull();
      expect(r.item.assetTag).not.toBe('PRJ-001');
    }
  });

  it('shows the loan once the request has been fulfilled', async () => {
    const t1 = await tokenFor('borrower1@lendlab.test');
    const created = await post(t1, valid(await itemId('LAP-001'), { requestedDays: 3 }));
    const reqId = created.body.request.id;
    const custodian = await prisma.user.findUniqueOrThrow({ where: { email: 'custodian.hw@lendlab.test' } });
    const checkedOutAt = new Date('2026-11-07T03:00:00.000Z');
    const dueAt = new Date('2026-11-10T03:00:00.000Z');
    // Simulate F-05 checkout directly in the database (the checkout endpoint belongs to #8).
    await prisma.$transaction([
      prisma.borrowRequest.update({ where: { id: reqId }, data: { status: 'FULFILLED' } }),
      prisma.item.update({ where: { assetTag: 'LAP-001' }, data: { status: 'ON_LOAN' } }),
      prisma.loan.create({
        data: {
          requestId: reqId,
          itemId: created.body.request.item.id,
          borrowerId: (await prisma.borrowRequest.findUniqueOrThrow({ where: { id: reqId } })).borrowerId,
          checkedOutById: custodian.id,
          checkedOutAt,
          dueAt,
        },
      }),
    ]);

    const res = await request(app).get('/api/requests/mine').set('Authorization', `Bearer ${t1}`);

    expect(res.body.requests[0]).toMatchObject({
      id: reqId,
      status: 'FULFILLED',
      item: { assetTag: 'LAP-001', status: 'ON_LOAN' },
      loan: { status: 'ACTIVE', checkedOutAt: checkedOutAt.toISOString(), dueAt: dueAt.toISOString() },
    });
  });

  it('returns an empty list for a borrower with no requests', async () => {
    const res = await request(app)
      .get('/api/requests/mine')
      .set('Authorization', `Bearer ${await tokenFor('borrower2@lendlab.test')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requests: [] });
  });
});

describe('GET /api/requests/:id', () => {
  it('a borrower reads their own request (TEST-04-10 / AC-04-06)', async () => {
    const t1 = await tokenFor('borrower1@lendlab.test');
    const created = await post(t1, valid(await itemId('LAP-001')));

    const res = await request(app)
      .get(`/api/requests/${created.body.request.id}`)
      .set('Authorization', `Bearer ${t1}`);

    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ id: created.body.request.id, status: 'PENDING' });
  });

  it("a borrower cannot read another borrower's request: 404, no data (TEST-02-04 / AC-02-04)", async () => {
    const t2 = await tokenFor('borrower2@lendlab.test');
    const theirs = await post(t2, valid(await itemId('CAM-001')));

    const res = await request(app)
      .get(`/api/requests/${theirs.body.request.id}`)
      .set('Authorization', `Bearer ${await tokenFor('borrower1@lendlab.test')}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.request).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/CAM-001|purpose/);
  });

  it('answers the same 404 for an id that does not exist', async () => {
    const res = await request(app)
      .get('/api/requests/99999')
      .set('Authorization', `Bearer ${await tokenFor('borrower1@lendlab.test')}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([['abc'], ['0'], ['1.5']])('rejects id=%s with 400', async (id) => {
    const res = await request(app)
      .get(`/api/requests/${id}`)
      .set('Authorization', `Bearer ${await tokenFor('borrower1@lendlab.test')}`);

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('id');
  });
});
