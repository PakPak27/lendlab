// F-10 BR-13 status changes. RED stub: Sprint 1 has no inventory status changes, so nothing is checked.
export type ManualStatus = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
export type AnyItemStatus = 'AVAILABLE' | 'RESERVED' | 'ON_LOAN' | 'MAINTENANCE' | 'RETIRED';
export type StatusChangeError = 'ITEM_IN_USE' | 'ITEM_RETIRED' | 'INVALID_STATUS_CHANGE';

export function statusChangeError(_from: AnyItemStatus, _to: ManualStatus): StatusChangeError | null {
  return null;
}
