// F-10 BR-13: which manual status changes a custodian may make (contract section 2 table).
// RESERVED and ON_LOAN are only set by requests and checkouts; RETIRED is final.
export type ManualStatus = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
export type AnyItemStatus = 'AVAILABLE' | 'RESERVED' | 'ON_LOAN' | 'MAINTENANCE' | 'RETIRED';
export type StatusChangeError = 'ITEM_IN_USE' | 'ITEM_RETIRED' | 'INVALID_STATUS_CHANGE';

export function statusChangeError(from: AnyItemStatus, to: ManualStatus): StatusChangeError | null {
  if (from === 'RETIRED') return 'ITEM_RETIRED';
  if (from === 'RESERVED' || from === 'ON_LOAN') return 'ITEM_IN_USE';
  if (from === to) return 'INVALID_STATUS_CHANGE';
  return null;
}
