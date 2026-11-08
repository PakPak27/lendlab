// F-01 TEST-01-11 (AC-01-02): an unknown e-mail still costs one bcrypt comparison,
// so response timing does not reveal which accounts exist.
import { describe, expect, it, vi } from 'vitest';
import { DUMMY_PASSWORD_HASH, login } from '../../src/services/authService.js';
import { AppError } from '../../src/lib/errors.js';

describe('authService.login', () => {
  it('runs bcrypt even when the e-mail is unknown', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const findUserByEmail = vi.fn().mockResolvedValue(null);
    const createSession = vi.fn();

    const attempt = login('nobody@lendlab.test', 'x', { findUserByEmail, createSession, verifyPassword });

    await expect(attempt).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledWith('x', DUMMY_PASSWORD_HASH);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('also runs bcrypt for an inactive user and creates no session', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const findUserByEmail = vi.fn().mockResolvedValue({
      id: 1, email: 'a@lendlab.test', name: 'A', role: 'BORROWER', isActive: false, passwordHash: 'hash', locations: [],
    });
    const createSession = vi.fn();

    await expect(
      login('a@lendlab.test', 'right-password', { findUserByEmail, createSession, verifyPassword }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
  });
});
