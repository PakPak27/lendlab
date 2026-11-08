import bcrypt from 'bcryptjs';

// NFR-01: passwords are only ever stored as bcrypt hashes (cost 10).
const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
