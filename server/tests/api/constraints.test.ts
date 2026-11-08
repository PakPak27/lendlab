// Database-level enforcement of BR-02 and BR-04 (migration add_business_rule_constraints).
// These tests write directly through Prisma, bypassing the services, to prove that the
// database itself is the last line of defence (NFR-05).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { disconnect, prisma, resetDatabase } from '../helpers/db.js';

async function ids() {
  const [lap1, lap3, prj2, borrower1, borrower2, custodian] = await Promise.all([
    prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-001' } }),
    prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-003' } }),
    prisma.item.findUniqueOrThrow({ where: { assetTag: 'PRJ-002' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'borrower1@lendlab.test' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'borrower2@lendlab.test' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'custodian.hw@lendlab.test' } }),
  ]);
  return { lap1, lap3, prj2, borrower1, borrower2, custodian };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('BR-02 one open commitment per item (database constraints)', () => {
  // TEST-04-04
  it('DB allows one pending request per item', async () => {
    const { lap3, borrower1, borrower2 } = await ids();
    await prisma.borrowRequest.create({
      data: { itemId: lap3.id, borrowerId: borrower1.id, purpose: 'First request', requestedDays: 3 },
    });
    await expect(
      prisma.borrowRequest.create({
        data: { itemId: lap3.id, borrowerId: borrower2.id, purpose: 'Second request', requestedDays: 3 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.borrowRequest.count({ where: { itemId: lap3.id, status: 'PENDING' } })).toBe(1);
  });

  it('allows a new pending request once the earlier one is no longer pending', async () => {
    const { lap3, borrower1, borrower2 } = await ids();
    await prisma.borrowRequest.create({
      data: { itemId: lap3.id, borrowerId: borrower1.id, purpose: 'Old request', requestedDays: 3, status: 'CANCELLED' },
    });
    await expect(
      prisma.borrowRequest.create({
        data: { itemId: lap3.id, borrowerId: borrower2.id, purpose: 'New request', requestedDays: 3 },
      }),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });

  // TEST-05-06
  it('DB allows one active loan per item', async () => {
    const { lap1, borrower1, borrower2, custodian } = await ids();
    const r1 = await prisma.borrowRequest.create({
      data: { itemId: lap1.id, borrowerId: borrower1.id, purpose: 'First loan', requestedDays: 7, status: 'FULFILLED' },
    });
    const r2 = await prisma.borrowRequest.create({
      data: { itemId: lap1.id, borrowerId: borrower2.id, purpose: 'Second loan', requestedDays: 7, status: 'FULFILLED' },
    });
    const dueAt = new Date(Date.now() + 7 * 86_400_000);
    await prisma.loan.create({
      data: { requestId: r1.id, itemId: lap1.id, borrowerId: borrower1.id, checkedOutById: custodian.id, dueAt },
    });
    await expect(
      prisma.loan.create({
        data: { requestId: r2.id, itemId: lap1.id, borrowerId: borrower2.id, checkedOutById: custodian.id, dueAt },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows only one loan per request (Loan.requestId unique)', async () => {
    const { lap1, borrower1, custodian } = await ids();
    const r1 = await prisma.borrowRequest.create({
      data: { itemId: lap1.id, borrowerId: borrower1.id, purpose: 'One loan only', requestedDays: 7, status: 'FULFILLED' },
    });
    const dueAt = new Date(Date.now() + 7 * 86_400_000);
    await prisma.loan.create({
      data: { requestId: r1.id, itemId: lap1.id, borrowerId: borrower1.id, checkedOutById: custodian.id, dueAt, status: 'RETURNED' },
    });
    await expect(
      prisma.loan.create({
        data: { requestId: r1.id, itemId: lap1.id, borrowerId: borrower1.id, checkedOutById: custodian.id, dueAt },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('BR-04 loan length 1-14 days (database CHECK constraint)', () => {
  it.each([1, 14])('accepts requestedDays = %i', async (days) => {
    const { prj2, borrower1 } = await ids();
    await expect(
      prisma.borrowRequest.create({
        data: { itemId: prj2.id, borrowerId: borrower1.id, purpose: 'Boundary test', requestedDays: days },
      }),
    ).resolves.toMatchObject({ requestedDays: days });
  });

  it.each([0, 15])('rejects requestedDays = %i', async (days) => {
    const { prj2, borrower1 } = await ids();
    await expect(
      prisma.borrowRequest.create({
        data: { itemId: prj2.id, borrowerId: borrower1.id, purpose: 'Boundary test', requestedDays: days },
      }),
    ).rejects.toThrow(/BorrowRequest_requestedDays_range|check constraint/i);
    expect(await prisma.borrowRequest.count()).toBe(0);
  });
});
