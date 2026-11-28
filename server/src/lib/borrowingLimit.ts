// F-09 BR-08 borrowing limit. RED stub: the Sprint 1 code has no limit, so it is never reached.
export const BORROWING_LIMIT = 3;

export function limitReached(_openCommitments: number): boolean {
  return false;
}
