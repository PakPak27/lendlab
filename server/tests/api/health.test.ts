// SYS-01: health, readiness, standard error shape, and seed data.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('SYS-01 health and readiness', () => {
  it('GET /api/health returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/ready confirms the database connection', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ db: 'connected' });
  });
});

describe('SYS-01 standard error shape (NFR-11)', () => {
  it('unknown API route returns 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('malformed JSON body returns 400 VALIDATION_ERROR without a stack trace', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+/);
  });
});

describe('SYS-01 seed data', () => {
  it('creates the demo locations, categories, items, and users', async () => {
    expect(await prisma.location.count()).toBe(2);
    expect(await prisma.category.count()).toBe(4);
    expect(await prisma.item.count()).toBe(10);
    expect(await prisma.user.count()).toBe(4);
  });

  it('seeds ARD-003 in MAINTENANCE and every other item AVAILABLE', async () => {
    const maintenance = await prisma.item.findMany({ where: { status: 'MAINTENANCE' } });
    expect(maintenance.map((i) => i.assetTag)).toEqual(['ARD-003']);
    expect(await prisma.item.count({ where: { status: 'AVAILABLE' } })).toBe(9);
  });

  it('assigns each custodian to exactly one location', async () => {
    const hw = await prisma.user.findUniqueOrThrow({
      where: { email: 'custodian.hw@lendlab.test' },
      include: { locations: { include: { location: true } } },
    });
    expect(hw.locations.map((l) => l.location.code)).toEqual(['HW-LAB']);
  });

  it('stores passwords only as bcrypt hashes (NFR-01)', async () => {
    const users = await prisma.user.findMany();
    for (const u of users) {
      expect(u.passwordHash).not.toContain('test-password');
      expect(u.passwordHash.startsWith('$2')).toBe(true);
    }
  });

  it('is idempotent: running the seed twice does not create duplicates', async () => {
    await resetDatabase();
    const { seed } = await import('../../prisma/seed.js');
    await seed(prisma, 'test-password-123');
    expect(await prisma.item.count()).toBe(10);
    expect(await prisma.user.count()).toBe(4);
  });
});

describe('SYS-01 business-rule constraints in the database', () => {
  it('allows only one PENDING request per item', async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-003' } });
    const borrower = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower1@lendlab.test' } });
    const data = { itemId: item.id, borrowerId: borrower.id, purpose: 'Constraint test', requestedDays: 3 };
    await prisma.borrowRequest.create({ data });
    await expect(prisma.borrowRequest.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects requestedDays outside 1-14 at the database level', async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { assetTag: 'PRJ-002' } });
    const borrower = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower2@lendlab.test' } });
    await expect(
      prisma.borrowRequest.create({
        data: { itemId: item.id, borrowerId: borrower.id, purpose: 'Constraint test', requestedDays: 15 },
      }),
    ).rejects.toThrow();
  });
});
