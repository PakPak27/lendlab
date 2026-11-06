// F-01 TEST-01-08 (AC-01-06): passwords are stored as bcrypt hashes and verify correctly.
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  it('hashes with bcrypt and verifies the correct password only', async () => {
    const plain = 'Secret123!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword('not-the-password', hash)).toBe(false);
  });

  it('uses bcrypt cost 10 (NFR-01)', async () => {
    const hash = await hashPassword('Secret123!');
    expect(hash.split('$')[2]).toBe('10');
  });
});
