// F-10 Inventory management (TEST-10-02 .. TEST-10-08), contract docs/sprints/sprint-2/F-10-inventory.md.
// Every refused call checks that the database did not change.
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
const HW = 'custodian.hw@lendlab.test';
const MEDIA = 'custodian.media@lendlab.test';
const ids = async () => {
  const [laptop, hw, media] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { name: 'Laptop' } }),
    prisma.location.findUniqueOrThrow({ where: { code: 'HW-LAB' } }),
    prisma.location.findUniqueOrThrow({ where: { code: 'MEDIA' } }),
  ]);
  return { laptopId: laptop.id, hwId: hw.id, mediaId: media.id };
};
const item = (assetTag: string) => prisma.item.findUniqueOrThrow({ where: { assetTag } });
const setStatus = async (email: string, assetTag: string, status: string) =>
  request(app)
    .post(`/api/custodian/items/${(await item(assetTag)).id}/status`)
    .set(bearer(await tokenFor(email)))
    .send({ status });

describe('GET /api/custodian/items', () => {
  it('lists every item in the custodian locations, including Maintenance (TEST-10-02 / AC-10-01)', async () => {
    const res = await request(app).get('/api/custodian/items').set(bearer(await tokenFor(HW)));

    expect(res.status).toBe(200);
    const tags = res.body.items.map((i: { assetTag: string }) => i.assetTag);
    expect(tags).toEqual(expect.arrayContaining(['LAP-001', 'LAP-002', 'LAP-003', 'ARD-001', 'ARD-002', 'ARD-003']));
    expect(tags).toHaveLength(6);
    expect(res.body.items.find((i: { assetTag: string }) => i.assetTag === 'ARD-003')).toMatchObject({
      status: 'MAINTENANCE',
      category: { name: 'Microcontroller Kit' },
      location: { code: 'HW-LAB' },
    });
  });
});

describe('POST /api/custodian/items', () => {
  it('adds an Available item that appears in the catalog and can be requested (TEST-10-03 / AC-10-02)', async () => {
    const { laptopId, hwId } = await ids();

    const res = await request(app)
      .post('/api/custodian/items')
      .set(bearer(await tokenFor(HW)))
      .send({ assetTag: 'LAP-010', name: 'Dell Latitude 7450', categoryId: laptopId, locationId: hwId, description: '14-inch, Core Ultra 7' });

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ assetTag: 'LAP-010', name: 'Dell Latitude 7450', status: 'AVAILABLE' });
    const catalog = await request(app).get('/api/items').set(bearer(await tokenFor('borrower1@lendlab.test')));
    expect(catalog.body.items.map((i: { assetTag: string }) => i.assetTag)).toContain('LAP-010');
    const req = await request(app)
      .post('/api/requests')
      .set(bearer(await tokenFor('borrower1@lendlab.test')))
      .send({ itemId: res.body.item.id, purpose: 'Testing the new laptop', requestedDays: 3 });
    expect(req.status).toBe(201);
  });

  it.each([
    ['asset tag with a space', { assetTag: 'lap 1' }, 'assetTag'],
    ['asset tag too short', { assetTag: 'L1' }, 'assetTag'],
    ['unknown category', { categoryId: 99999 }, 'categoryId'],
    ['name of 1 character', { name: 'X' }, 'name'],
    ['location of another custodian', { useMedia: true }, 'locationId'],
  ])('refuses %s with 400 and saves nothing (TEST-10-04 / AC-10-03)', async (_name, over, field) => {
    const { laptopId, hwId, mediaId } = await ids();
    const { useMedia, ...rest } = over as Record<string, unknown>;
    const body = { assetTag: 'LAP-011', name: 'Spare laptop', categoryId: laptopId, locationId: useMedia ? mediaId : hwId, ...rest };
    const before = await prisma.item.count();

    const res = await request(app).post('/api/custodian/items').set(bearer(await tokenFor(HW))).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe(field);
    expect(await prisma.item.count()).toBe(before);
  });

  it('refuses a duplicate asset tag with 409 (TEST-10-04 / AC-10-03)', async () => {
    const { laptopId, hwId } = await ids();
    const before = await prisma.item.count();

    const res = await request(app)
      .post('/api/custodian/items')
      .set(bearer(await tokenFor(HW)))
      .send({ assetTag: 'LAP-001', name: 'Duplicate', categoryId: laptopId, locationId: hwId });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ASSET_TAG_TAKEN');
    expect(await prisma.item.count()).toBe(before);
  });
});

describe('PATCH /api/custodian/items/:id', () => {
  it('edits name and description; another location is 404 (TEST-10-05 / AC-10-04)', async () => {
    const lap2 = await item('LAP-002');
    const cam1 = await item('CAM-001');
    const token = await tokenFor(HW);

    const res = await request(app).patch(`/api/custodian/items/${lap2.id}`).set(bearer(token)).send({ name: 'Dell Latitude 5440 (spare)', description: 'Charger in the bag' });
    const other = await request(app).patch(`/api/custodian/items/${cam1.id}`).set(bearer(token)).send({ name: 'Not mine' });

    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ assetTag: 'LAP-002', name: 'Dell Latitude 5440 (spare)', description: 'Charger in the bag' });
    expect(other.status).toBe(404);
    expect((await item('CAM-001')).name).toBe('Canon EOS M50');
    const catalog = await request(app).get(`/api/items/${lap2.id}`).set(bearer(token));
    expect(catalog.body.item.name).toBe('Dell Latitude 5440 (spare)');
  });
});

describe('POST /api/custodian/items/:id/status', () => {
  it('follows the status table and leaves refused items unchanged (TEST-10-06 / AC-10-05)', async () => {
    expect((await setStatus(HW, 'LAP-001', 'MAINTENANCE')).status).toBe(200);
    expect((await setStatus(HW, 'LAP-001', 'AVAILABLE')).status).toBe(200);
    expect((await setStatus(HW, 'LAP-001', 'RETIRED')).status).toBe(200);
    expect((await item('LAP-001')).status).toBe('RETIRED');

    const retired = await setStatus(HW, 'LAP-001', 'AVAILABLE');
    expect(retired.status).toBe(409);
    expect(retired.body.error.code).toBe('ITEM_RETIRED');

    await createPendingRequest({ assetTag: 'LAP-002' });
    await createActiveLoan({ assetTag: 'LAP-003' });
    for (const [tag, was] of [['LAP-002', 'RESERVED'], ['LAP-003', 'ON_LOAN']] as const) {
      const res = await setStatus(HW, tag, 'MAINTENANCE');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ITEM_IN_USE');
      expect((await item(tag)).status).toBe(was);
    }

    const same = await setStatus(HW, 'ARD-001', 'AVAILABLE');
    expect(same.status).toBe(409);
    expect(same.body.error.code).toBe('INVALID_STATUS_CHANGE');

    const bad = await setStatus(HW, 'ARD-001', 'ON_LOAN');
    expect(bad.status).toBe(400);
    expect((await item('ARD-001')).status).toBe('AVAILABLE');
  });

  it('hides a Retired item from the catalog and refuses requests for it (TEST-10-07 / AC-10-06)', async () => {
    const lap3 = await item('LAP-003');
    await setStatus(HW, 'LAP-003', 'RETIRED');
    const borrower = await tokenFor('borrower1@lendlab.test');

    const list = await request(app).get('/api/items').set(bearer(borrower));
    const detail = await request(app).get(`/api/items/${lap3.id}`).set(bearer(borrower));
    const req = await request(app).post('/api/requests').set(bearer(borrower)).send({ itemId: lap3.id, purpose: 'Retired laptop', requestedDays: 3 });
    const inventory = await request(app).get('/api/custodian/items').set(bearer(await tokenFor(HW)));

    expect(list.body.items.map((i: { assetTag: string }) => i.assetTag)).not.toContain('LAP-003');
    expect(detail.status).toBe(404);
    expect([404, 409]).toContain(req.status);
    expect(inventory.body.items.find((i: { assetTag: string }) => i.assetTag === 'LAP-003').status).toBe('RETIRED');
  });

  it('is 403 for a borrower and 404 for another custodian (TEST-10-08 / AC-10-07)', async () => {
    const borrower = await tokenFor('borrower1@lendlab.test');
    const { laptopId, hwId } = await ids();

    const list = await request(app).get('/api/custodian/items').set(bearer(borrower));
    const add = await request(app).post('/api/custodian/items').set(bearer(borrower)).send({ assetTag: 'LAP-012', name: 'Mine', categoryId: laptopId, locationId: hwId });
    const status = await setStatus('borrower1@lendlab.test', 'LAP-001', 'MAINTENANCE');
    const media = await setStatus(MEDIA, 'LAP-001', 'MAINTENANCE');

    expect([list.status, add.status, status.status]).toEqual([403, 403, 403]);
    expect(media.status).toBe(404);
    expect((await item('LAP-001')).status).toBe('AVAILABLE');
    expect(await prisma.item.count({ where: { assetTag: 'LAP-012' } })).toBe(0);
  });
});
