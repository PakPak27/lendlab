import { Prisma } from '@prisma/client';

// True when err is a Prisma unique-constraint violation (P2002).
// If `target` is given, also checks that the violated constraint/index matches it,
// so each service can map its own conflict to the right error code, e.g.
//   isUniqueViolation(err, 'BorrowRequest_one_pending_per_item') -> ITEM_NOT_AVAILABLE
//   isUniqueViolation(err, 'requestId')                          -> REQUEST_NOT_PENDING
export function isUniqueViolation(err: unknown, target?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  if (!target) return true;
  const meta = err.meta?.target;
  const targets = Array.isArray(meta) ? meta.map(String) : meta ? [String(meta)] : [];
  return targets.some((t) => t === target || t.includes(target));
}
