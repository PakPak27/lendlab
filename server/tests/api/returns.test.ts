// F-07 Active loans and returns (TEST-07-01 .. TEST-07-06), contract docs/sprints/sprint-2/F-07-returns.md.
// Every refused call checks that the database did not change.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';
import { createActiveLoan } from '../helpers/requests.js';

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
const returnLoan = async (email: string, id: number, body: unknown = {}) =>
  request(app).post(`/api/custodian/loans/${id}/return`).set(bearer(await tokenFor(email))).send(body as object);

async function loanState(id: number) {
  const l = await prisma.loan.findUniqueOrThrow({ where: { id }, include: { item: true, request: true } });
  return { status: l.status, returnedAt: l.returnedAt, returnedById: l.returnedById, item: l.item.status, request: l.request.status };
}

describe('GET /api/custodian/loans', () => {
  it('lists only active loans in the custodian locations, soonest due first (TEST-07-01 / AC-07-01)', async () => {
    const later = await createActiveLoan({ assetTag: 'LAP-001', dueAt: new Date('2026-12-10T03:00:00Z') });
    const sooner = await createActiveLoan({ assetTag: 'LAP-002', borrowerEmail: 'borrower2@lendlab.test', dueAt: new Date('2026-12-05T03:00:00Z') });
    const returned = await createActiveLoan({ assetTag: 'ARD-001' });
    await prisma.loan.update({ where: { id: returned.loan.id }, data: { status: 'RETURNED', returnedAt: new Date() } });
    await createActiveLoan({ assetTag: 'CAM-001', custodianEmail: 'custodian.media@lendlab.test' });

    const res = await request(app).get('/api/custodian/loans').set(bearer(await tokenFor('custodian.hw@lendlab.test')));

    expect(res.status).toBe(200);
    expect(res.body.loans.map((l: { id: number }) => l.id)).toEqual([sooner.loan.id, later.loan.id]);
    expect(res.body.loans[0]).toMatchObject({
      status: 'ACTIVE',
      dueAt: '2026-12-05T03:00:00.000Z',
      item: { assetTag: 'LAP-002', name: 'Dell Latitude 5440', location: { code: 'HW-LAB' } },
      borrower: { name: 'Borrower Two', email: 'borrower2@lendlab.test' },
    });
  });
});

describe('POST /api/custodian/loans/:id/return', () => {
  it('records a return: loan Returned, item Available, request stays Fulfilled (TEST-07-02 / AC-07-02)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001' });
    const custodian = await prisma.user.findUniqueOrThrow({ where: { email: 'custodian.hw@lendlab.test' } });

    const res = await returnLoan('custodian.hw@lendlab.test', loan.id, { needsMaintenance: false });

    expect(res.status).toBe(200);
    expect(res.body.loan).toMatchObject({ id: loan.id, status: 'RETURNED', item: { assetTag: 'LAP-001', status: 'AVAILABLE' } });
    const s = await loanState(loan.id);
    expect(s).toMatchObject({ status: 'RETURNED', returnedById: custodian.id, item: 'AVAILABLE', request: 'FULFILLED' });
    expect(s.returnedAt).not.toBeNull();
  });

  it('sends the item to Maintenance when asked (TEST-07-03 / AC-07-03)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001' });

    const res = await returnLoan('custodian.hw@lendlab.test', loan.id, { needsMaintenance: true });

    expect(res.status).toBe(200);
    expect((await loanState(loan.id)).item).toBe('MAINTENANCE');
  });

  it('returns a loan only once, also when two returns run together (TEST-07-04 / AC-07-04)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001' });
    const first = await returnLoan('custodian.hw@lendlab.test', loan.id);
    const returnedAt = (await loanState(loan.id)).returnedAt;

    const second = await returnLoan('custodian.hw@lendlab.test', loan.id, { needsMaintenance: true });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('LOAN_NOT_ACTIVE');
    expect(await loanState(loan.id)).toMatchObject({ status: 'RETURNED', returnedAt, item: 'AVAILABLE' });

    const { loan: other } = await createActiveLoan({ assetTag: 'LAP-002' });
    const token = await tokenFor('custodian.hw@lendlab.test');
    const both = await Promise.all([
      request(app).post(`/api/custodian/loans/${other.id}/return`).set(bearer(token)).send({}),
      request(app).post(`/api/custodian/loans/${other.id}/return`).set(bearer(token)).send({}),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('is 404 for another location, 403 for a borrower and 400 for a bad body (TEST-07-05 / AC-07-05)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001' });

    const media = await returnLoan('custodian.media@lendlab.test', loan.id);
    const borrower = await returnLoan('borrower1@lendlab.test', loan.id);
    const borrowerList = await request(app).get('/api/custodian/loans').set(bearer(await tokenFor('borrower1@lendlab.test')));
    const badBody = await returnLoan('custodian.hw@lendlab.test', loan.id, { needsMaintenance: 'yes' });

    expect(media.status).toBe(404);
    expect(borrower.status).toBe(403);
    expect(borrowerList.status).toBe(403);
    expect(badBody.status).toBe(400);
    expect(badBody.body.error.details[0].field).toBe('needsMaintenance');
    expect(await loanState(loan.id)).toMatchObject({ status: 'ACTIVE', returnedAt: null, item: 'ON_LOAN' });
  });

  it('makes the item requestable again and shows Returned in My Borrowing (TEST-07-06 / AC-07-06)', async () => {
    const { loan, item } = await createActiveLoan({ assetTag: 'LAP-001' });
    await returnLoan('custodian.hw@lendlab.test', loan.id);

    const mine = await request(app).get('/api/requests/mine').set(bearer(await tokenFor('borrower1@lendlab.test')));
    const again = await request(app)
      .post('/api/requests')
      .set(bearer(await tokenFor('borrower2@lendlab.test')))
      .send({ itemId: item.id, purpose: 'Second borrower project', requestedDays: 3 });

    expect(mine.body.requests[0].loan).toMatchObject({ id: loan.id, status: 'RETURNED' });
    expect(mine.body.requests[0].loan.returnedAt).toBeTruthy();
    expect(again.status).toBe(201);
  });
});
