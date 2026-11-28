// F-09 BR-08: a borrower may hold at most 3 open commitments (Pending requests plus Active loans).
export const BORROWING_LIMIT = 3;

export function limitReached(openCommitments: number): boolean {
  return openCommitments >= BORROWING_LIMIT;
}
