// F-09 Borrowing limit (TEST-09-02 .. TEST-09-06), contract docs/sprints/sprint-2/F-09-borrowing-limit.md.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';
import { createActiveLoan, createPendingRequest } from '../helpers/requests.js';

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
const itemId = async (assetTag: string) => (await prisma.item.findUniqueOrThrow({ where: { assetTag } })).id;
const post = async (token: string, assetTag: string) =>
  request(app).post('/api/requests').set(bearer(token)).send({ itemId: await itemId(assetTag), purpose: 'Group project work', requestedDays: 3 });
const status = async (assetTag: string) => (await prisma.item.findUniqueOrThrow({ where: { assetTag } })).status;

const LIMIT_MESSAGE = 'You already have 3 open requests or loans. Cancel a request or return an item first.';

describe('borrowing limit (F-09, BR-08)', () => {
  it('allows the 3rd open commitment and refuses the 4th (TEST-09-02 / AC-09-02)', async () => {
    await createPendingRequest({ assetTag: 'LAP-001' });
    await createPendingRequest({ assetTag: 'LAP-002' });
    const token = await tokenFor('borrower1@lendlab.test');

    const third = await post(token, 'ARD-001');
    const before = await prisma.borrowRequest.count();
    const fourth = await post(token, 'ARD-002');

    expect(third.status).toBe(201);
    expect(fourth.status).toBe(409);
    expect(fourth.body.error).toMatchObject({ code: 'BORROWING_LIMIT', message: LIMIT_MESSAGE });
    expect(await prisma.borrowRequest.count()).toBe(before);
    expect(await status('ARD-002')).toBe('AVAILABLE');
  });

  it('counts active loans as open commitments (TEST-09-03 / AC-09-03)', async () => {
    await createPendingRequest({ assetTag: 'LAP-001' });
    await createActiveLoan({ assetTag: 'LAP-002' });
    await createActiveLoan({ assetTag: 'LAP-003' });

    const res = await post(await tokenFor('borrower1@lendlab.test'), 'ARD-001');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BORROWING_LIMIT');
    expect(await status('ARD-001')).toBe('AVAILABLE');
  });

  it('does not count cancelled, rejected or returned records (TEST-09-04 / AC-09-04)', async () => {
    const a = await createPendingRequest({ assetTag: 'LAP-001' });
    const b = await createPendingRequest({ assetTag: 'LAP-002' });
    const { loan } = await createActiveLoan({ assetTag: 'LAP-003' });
    await prisma.borrowRequest.update({ where: { id: a.request.id }, data: { status: 'CANCELLED' } });
    await prisma.borrowRequest.update({ where: { id: b.request.id }, data: { status: 'REJECTED' } });
    await prisma.loan.update({ where: { id: loan.id }, data: { status: 'RETURNED', returnedAt: new Date() } });
    const token = await tokenFor('borrower1@lendlab.test');

    const results = [await post(token, 'ARD-001'), await post(token, 'ARD-002'), await post(token, 'CAM-002')];

    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
  });

  it('applies per borrower (TEST-09-05 / AC-09-05)', async () => {
    await createPendingRequest({ assetTag: 'LAP-001' });
    await createPendingRequest({ assetTag: 'LAP-002' });
    await createPendingRequest({ assetTag: 'LAP-003' });

    const res = await post(await tokenFor('borrower2@lendlab.test'), 'ARD-001');

    expect(res.status).toBe(201);
  });

  it('lets only one of two simultaneous requests past the limit (TEST-09-06 / AC-09-06)', async () => {
    await createPendingRequest({ assetTag: 'LAP-001' });
    await createPendingRequest({ assetTag: 'LAP-002' });
    const token = await tokenFor('borrower1@lendlab.test');

    const both = await Promise.all([post(token, 'ARD-001'), post(token, 'ARD-002')]);

    expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
    const borrower = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower1@lendlab.test' } });
    expect(await prisma.borrowRequest.count({ where: { borrowerId: borrower.id, status: 'PENDING' } })).toBe(3);
  });

  it('checks the overdue rule before the limit (SIT2-03)', async () => {
    await createPendingRequest({ assetTag: 'LAP-001' });
    await createPendingRequest({ assetTag: 'LAP-002' });
    await createActiveLoan({ assetTag: 'LAP-003', checkedOutAt: new Date(Date.now() - 9 * 86_400_000), dueAt: new Date(Date.now() - 86_400_000) });

    const res = await post(await tokenFor('borrower1@lendlab.test'), 'ARD-001');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERDUE_LOAN');
  });
});
