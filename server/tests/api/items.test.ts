// F-03 Equipment Catalog: list, status filter and item detail (TEST-03-01 .. TEST-03-03).
// Anonymous access to /api/items -> 401 is covered by TEST-02-01 in access.test.ts.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, prisma, resetDatabase, TEST_PASSWORD } from '../helpers/db.js';

const app = createApp();
let token: string;

beforeAll(async () => {
  await resetDatabase();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'borrower1@lendlab.test', password: TEST_PASSWORD });
  token = res.body.token;
});

afterAll(async () => {
  await disconnect();
});

const get = (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`);

describe('GET /api/items', () => {
  it('lists catalog items with category, location and status (TEST-03-01 / AC-03-01)', async () => {
    const res = await get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
    for (const item of res.body.items) {
      expect(item).toEqual({
        id: expect.any(Number),
        assetTag: expect.any(String),
        name: expect.any(String),
        category: { id: expect.any(Number), name: expect.any(String) },
        location: { id: expect.any(Number), code: expect.any(String), name: expect.any(String) },
        status: expect.any(String),
      });
    }
  });

  it('sorts by name, then asset tag (TEST-03-01 / AC-03-01)', async () => {
    const res = await get('/api/items');
    const keys = res.body.items.map((i: { name: string; assetTag: string }) => [i.name, i.assetTag]);
    const sorted = [...keys].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

    expect(keys).toEqual(sorted);
    // Two items share the name "Dell Latitude 5440": the asset tag breaks the tie.
    const dell = res.body.items.filter((i: { name: string }) => i.name === 'Dell Latitude 5440');
    expect(dell.map((i: { assetTag: string }) => i.assetTag)).toEqual(['LAP-001', 'LAP-002']);
  });

  it('never reveals who has requested or borrowed an item (privacy, F-03 section 3)', async () => {
    const borrower2 = await prisma.user.findUniqueOrThrow({ where: { email: 'borrower2@lendlab.test' } });
    const cam = await prisma.item.update({ where: { assetTag: 'CAM-001' }, data: { status: 'RESERVED' } });
    await prisma.borrowRequest.create({
      data: { itemId: cam.id, borrowerId: borrower2.id, purpose: 'Privacy check', requestedDays: 2 },
    });

    const res = await get('/api/items');
    const body = JSON.stringify(res.body);

    expect(res.body.items.find((i: { assetTag: string }) => i.assetTag === 'CAM-001').status).toBe('RESERVED');
    expect(body).not.toMatch(/borrower|Borrower Two|requests|loans|purpose/i);

    await prisma.borrowRequest.deleteMany();
    await prisma.item.update({ where: { id: cam.id }, data: { status: 'AVAILABLE' } });
  });

  it('hides retired items', async () => {
    await prisma.item.update({ where: { assetTag: 'PRJ-002' }, data: { status: 'RETIRED' } });

    const res = await get('/api/items');

    expect(res.body.items).toHaveLength(9);
    expect(res.body.items.map((i: { assetTag: string }) => i.assetTag)).not.toContain('PRJ-002');

    await prisma.item.update({ where: { assetTag: 'PRJ-002' }, data: { status: 'AVAILABLE' } });
  });

  it('is readable by a custodian too', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'custodian.media@lendlab.test', password: TEST_PASSWORD });
    const res = await request(app).get('/api/items').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
  });
});

describe('GET /api/items?status=', () => {
  it('returns only items with the given status (TEST-03-02 / AC-03-02)', async () => {
    const res = await get('/api/items?status=AVAILABLE');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(9);
    expect(res.body.items.every((i: { status: string }) => i.status === 'AVAILABLE')).toBe(true);
    expect(res.body.items.map((i: { assetTag: string }) => i.assetTag)).not.toContain('ARD-003');
  });

  it('filters MAINTENANCE items', async () => {
    const res = await get('/api/items?status=MAINTENANCE');

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { assetTag: string }) => i.assetTag)).toEqual(['ARD-003']);
  });

  it.each([['BROKEN'], ['RETIRED'], ['available']])(
    'rejects status=%s with 400 VALIDATION_ERROR (TEST-03-02 / AC-03-02)',
    async (status) => {
      const res = await get(`/api/items?status=${status}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('status');
    },
  );
});

describe('GET /api/items/:id', () => {
  it('returns one item with its description (TEST-03-03 / AC-03-03)', async () => {
    const lap = await prisma.item.findUniqueOrThrow({ where: { assetTag: 'LAP-001' } });

    const res = await get(`/api/items/${lap.id}`);

    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({
      id: lap.id,
      assetTag: 'LAP-001',
      name: 'Dell Latitude 5440',
      description: '14-inch laptop, Core i5, 16 GB RAM',
      category: { name: 'Laptop' },
      location: { code: 'HW-LAB', name: 'CPE Hardware Lab' },
      status: 'AVAILABLE',
    });
  });

  it('answers 404 ITEM_NOT_FOUND for an unknown id (TEST-03-03 / AC-03-03)', async () => {
    const res = await get('/api/items/99999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
    expect(res.body.item).toBeUndefined();
  });

  it('answers 404 ITEM_NOT_FOUND for a retired item', async () => {
    const prj = await prisma.item.update({ where: { assetTag: 'PRJ-002' }, data: { status: 'RETIRED' } });

    const res = await get(`/api/items/${prj.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ITEM_NOT_FOUND');

    await prisma.item.update({ where: { id: prj.id }, data: { status: 'AVAILABLE' } });
  });

  it.each([['abc'], ['0'], ['-1'], ['1.5'], ['99999999999'], ['1e3']])('rejects id=%s with 400 VALIDATION_ERROR', async (id) => {
    const res = await get(`/api/items/${id}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('id');
  });
});
