// F-08 Due dates and overdue status (TEST-08-02 .. TEST-08-05), contract docs/sprints/sprint-2/F-08-overdue.md.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';
import { createActiveLoan } from '../helpers/requests.js';

const app = createApp();
const DAY = 86_400_000;

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
const requestItem = async (email: string, assetTag: string) =>
  request(app)
    .post('/api/requests')
    .set(bearer(await tokenFor(email)))
    .send({ itemId: await itemId(assetTag), purpose: 'Final year project', requestedDays: 3 });

describe('overdue loans (F-08)', () => {
  it('flags an overdue loan for the borrower and the custodian (TEST-08-02 / AC-08-02)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001', checkedOutAt: new Date(Date.now() - 8 * DAY), dueAt: new Date(Date.now() - DAY) });
    await createActiveLoan({ assetTag: 'LAP-002', borrowerEmail: 'borrower2@lendlab.test', dueAt: new Date(Date.now() + DAY) });

    const mine = await request(app).get('/api/requests/mine').set(bearer(await tokenFor('borrower1@lendlab.test')));
    const loans = await request(app).get('/api/custodian/loans').set(bearer(await tokenFor('custodian.hw@lendlab.test')));

    expect(mine.body.requests[0].loan).toMatchObject({ id: loan.id, isOverdue: true });
    const flags = Object.fromEntries(loans.body.loans.map((l: { item: { assetTag: string }; isOverdue: boolean }) => [l.item.assetTag, l.isOverdue]));
    expect(flags).toEqual({ 'LAP-001': true, 'LAP-002': false });
  });

  it('blocks new requests while the borrower has an overdue loan (TEST-08-03 / AC-08-03)', async () => {
    await createActiveLoan({ assetTag: 'LAP-001', checkedOutAt: new Date(Date.now() - 8 * DAY), dueAt: new Date(Date.now() - DAY) });
    const before = await prisma.borrowRequest.count();

    const res = await requestItem('borrower1@lendlab.test', 'ARD-001');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'OVERDUE_LOAN',
      message: 'You have an overdue loan. Return it before requesting another item.',
    });
    expect(await prisma.borrowRequest.count()).toBe(before);
    expect((await prisma.item.findUniqueOrThrow({ where: { assetTag: 'ARD-001' } })).status).toBe('AVAILABLE');
  });

  it('allows requests again after the overdue loan is returned (TEST-08-04 / AC-08-04)', async () => {
    const { loan } = await createActiveLoan({ assetTag: 'LAP-001', checkedOutAt: new Date(Date.now() - 8 * DAY), dueAt: new Date(Date.now() - DAY) });
    const ret = await request(app).post(`/api/custodian/loans/${loan.id}/return`).set(bearer(await tokenFor('custodian.hw@lendlab.test'))).send({});
    expect(ret.status).toBe(200);

    const res = await requestItem('borrower1@lendlab.test', 'ARD-001');

    expect(res.status).toBe(201);
  });

  it('does not block a borrower whose loan is not yet due (TEST-08-05 / AC-08-05)', async () => {
    await createActiveLoan({ assetTag: 'LAP-001', dueAt: new Date(Date.now() + DAY) });

    const res = await requestItem('borrower1@lendlab.test', 'ARD-001');

    expect(res.status).toBe(201);
  });
});
