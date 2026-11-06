import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { getConfig } from '../config.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/password.js';
import { generateToken, hashToken } from '../lib/session.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  locationIds: number[];
}

export interface LoginUserRecord {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  passwordHash: string;
  locations: Array<{ locationId: number }>;
}

// Compared against when the e-mail is unknown, so an unknown e-mail costs the same
// bcrypt work as a wrong password and response time does not reveal which accounts exist.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('lendlab-dummy-password', 10);

export interface LoginDeps {
  findUserByEmail: (email: string) => Promise<LoginUserRecord | null>;
  createSession: (userId: number, tokenHash: string, expiresAt: Date) => Promise<unknown>;
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
}

const defaultDeps: LoginDeps = {
  findUserByEmail: (email) =>
    prisma.user.findUnique({ where: { email }, include: { locations: { select: { locationId: true } } } }),
  createSession: (userId, tokenHash, expiresAt) => prisma.session.create({ data: { userId, tokenHash, expiresAt } }),
  verifyPassword,
};

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid e-mail or password.');

export function toAuthUser(user: {
  id: number;
  email: string;
  name: string;
  role: Role;
  locations: Array<{ locationId: number }>;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locationIds: user.locations.map((l) => l.locationId).sort((a, b) => a - b),
  };
}

// FR-01: unknown e-mail, wrong password and inactive user all fail the same way.
export async function login(
  email: string,
  password: string,
  deps: LoginDeps = defaultDeps,
): Promise<{ token: string; user: AuthUser }> {
  const user = await deps.findUserByEmail(email);

  // The password check always runs, even when there is nothing real to compare against.
  const passwordOk = await deps.verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !user.isActive || !passwordOk) {
    throw invalidCredentials();
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + getConfig().SESSION_TTL_HOURS * 3_600_000);
  await deps.createSession(user.id, hashToken(token), expiresAt);

  return { token, user: toAuthUser(user) };
}

// Server-side logout: the token stops working immediately (FR-03, NFR-04).
export async function logout(sessionId: number): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}
