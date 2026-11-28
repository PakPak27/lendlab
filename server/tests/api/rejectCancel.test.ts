// F-06 Request rejection and cancellation (TEST-06-01 .. TEST-06-06), contract docs/sprints/sprint-2/F-06-reject-cancel.md.
// Every refused call checks that the database did not change.
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
const reject = async (email: string, id: number, reason: unknown) =>
  request(app).post(`/api/custodian/requests/${id}/reject`).set(bearer(await tokenFor(email))).send({ reason });
const cancel = async (email: string, id: number) =>
  request(app).post(`/api/requests/${id}/cancel`).set(bearer(await tokenFor(email)));

async function state(requestId: number) {
  const r = await prisma.borrowRequest.findUniqueOrThrow({ where: { id: requestId }, include: { item: true } });
  return { status: r.status, note: r.decisionNote, decidedById: r.decidedById, itemStatus: r.item.status };
}

describe('POST /api/custodian/requests/:id/reject', () => {
  it('rejects a pending request with a reason and frees the item (TEST-06-01 / AC-06-01)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    const custodian = await prisma.user.findUniqueOrThrow({ where: { email: 'custodian.hw@lendlab.test' } });

    const res = await reject('custodian.hw@lendlab.test', r.id, 'Item reserved for a class');

    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ id: r.id, status: 'REJECTED', decisionNote: 'Item reserved for a class' });
    expect(res.body.request.item).toMatchObject({ assetTag: 'LAP-001', status: 'AVAILABLE' });
    expect(await state(r.id)).toEqual({
      status: 'REJECTED',
      note: 'Item reserved for a class',
      decidedById: custodian.id,
      itemStatus: 'AVAILABLE',
    });
    expect((await prisma.borrowRequest.findUniqueOrThrow({ where: { id: r.id } })).decidedAt).not.toBeNull();
  });

  it.each([
    ['4 characters', 'abcd', 400],
    ['only spaces', '          ', 400],
    ['201 characters', 'x'.repeat(201), 400],
    ['5 characters', 'abcde', 200],
    ['200 characters', 'y'.repeat(200), 200],
  ])('reason of %s -> %i (TEST-06-02 / AC-06-02)', async (_name, reason, expected) => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });

    const res = await reject('custodian.hw@lendlab.test', r.id, reason);

    expect(res.status).toBe(expected);
    if (expected === 400) {
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('reason');
      expect(await state(r.id)).toMatchObject({ status: 'PENDING', itemStatus: 'RESERVED' });
    } else {
      expect(await state(r.id)).toMatchObject({ status: 'REJECTED', itemStatus: 'AVAILABLE' });
    }
  });

  it('refuses requests that are not pending, for reject and cancel (TEST-06-03 / AC-06-03)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    for (const status of ['FULFILLED', 'REJECTED', 'CANCELLED'] as const) {
      await prisma.borrowRequest.update({ where: { id: r.id }, data: { status } });
      await prisma.item.update({ where: { id: r.itemId }, data: { status: 'ON_LOAN' } });

      const rej = await reject('custodian.hw@lendlab.test', r.id, 'Not needed any more');
      const can = await cancel('borrower1@lendlab.test', r.id);

      expect(rej.status).toBe(409);
      expect(rej.body.error.code).toBe('REQUEST_NOT_PENDING');
      expect(can.status).toBe(409);
      expect(can.body.error.code).toBe('REQUEST_NOT_PENDING');
      expect(await state(r.id)).toMatchObject({ status, itemStatus: 'ON_LOAN' });
    }
  });

  it('is 404 for another location and 403 for a borrower (TEST-06-04 / AC-06-04)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });

    const media = await reject('custodian.media@lendlab.test', r.id, 'Not my location');
    const borrower = await reject('borrower1@lendlab.test', r.id, 'Borrowers cannot reject');

    expect(media.status).toBe(404);
    expect(borrower.status).toBe(403);
    expect(await state(r.id)).toMatchObject({ status: 'PENDING', itemStatus: 'RESERVED', note: null });
  });

  it('lets exactly one of a rejection and a checkout win (TEST-06-06 / AC-06-06)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-001' });
    const token = await tokenFor('custodian.hw@lendlab.test');

    const [rej, out] = await Promise.all([
      request(app).post(`/api/custodian/requests/${r.id}/reject`).set(bearer(token)).send({ reason: 'Race condition test' }),
      request(app).post(`/api/custodian/requests/${r.id}/checkout`).set(bearer(token)),
    ]);

    const codes = [rej.status, out.status].sort();
    expect([200, 201]).toContain(codes[0]);
    expect(codes[1]).toBe(409);
    const s = await state(r.id);
    const loans = await prisma.loan.count({ where: { requestId: r.id } });
    if (s.status === 'REJECTED') expect({ item: s.itemStatus, loans }).toEqual({ item: 'AVAILABLE', loans: 0 });
    else expect({ status: s.status, item: s.itemStatus, loans }).toEqual({ status: 'FULFILLED', item: 'ON_LOAN', loans: 1 });
  });
});

describe('POST /api/requests/:id/cancel', () => {
  it('lets the borrower cancel their own pending request; others are refused (TEST-06-05 / AC-06-05)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'CAM-001' });

    const other = await cancel('borrower2@lendlab.test', r.id);
    const custodian = await cancel('custodian.media@lendlab.test', r.id);
    expect(other.status).toBe(404);
    expect(custodian.status).toBe(403);
    expect(await state(r.id)).toMatchObject({ status: 'PENDING', itemStatus: 'RESERVED' });

    const own = await cancel('borrower1@lendlab.test', r.id);

    expect(own.status).toBe(200);
    expect(own.body.request).toMatchObject({ id: r.id, status: 'CANCELLED' });
    expect(await state(r.id)).toMatchObject({ status: 'CANCELLED', itemStatus: 'AVAILABLE' });
  });

  it('shows the rejection reason in My Borrowing (AC-06-07, API part)', async () => {
    const { request: r } = await createPendingRequest({ assetTag: 'LAP-002' });
    await reject('custodian.hw@lendlab.test', r.id, 'Booked for the open house');

    const res = await request(app).get('/api/requests/mine').set(bearer(await tokenFor('borrower1@lendlab.test')));

    expect(res.status).toBe(200);
    expect(res.body.requests[0]).toMatchObject({ id: r.id, status: 'REJECTED', decisionNote: 'Booked for the open house' });
  });
});
