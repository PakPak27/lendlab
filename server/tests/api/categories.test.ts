// F-03 TEST-03-04 (AC-03-04): the category list is public (the Lab 5 smoke test reads it without signing in).
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { disconnect, resetDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('GET /api/categories', () => {
  it('is public and returns a non-empty plain array (TEST-03-04 / AC-03-04)', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('returns id and name only, sorted by name', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.body).toEqual([
      { id: expect.any(Number), name: 'Camera' },
      { id: expect.any(Number), name: 'Laptop' },
      { id: expect.any(Number), name: 'Microcontroller Kit' },
      { id: expect.any(Number), name: 'Projector' },
    ]);
  });
});
