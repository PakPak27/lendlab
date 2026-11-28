import { apiFetch } from './client';
import type { ItemStatus } from './items';

export type RequestStatus = 'PENDING' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';

export interface BorrowRequest {
  id: number;
  status: RequestStatus;
  purpose: string;
  requestedDays: number;
  createdAt: string;
  decidedAt?: string | null; // F-06
  decisionNote?: string | null; // F-06: rejection reason
  item: { id: number; assetTag: string; name: string; status: ItemStatus | 'RETIRED' };
  loan: null | {
    id: number;
    status: 'ACTIVE' | 'RETURNED';
    checkedOutAt: string;
    dueAt: string;
    returnedAt?: string | null; // F-07
    isOverdue?: boolean; // F-08
  };
}

export interface NewRequest {
  itemId: number;
  purpose: string;
  requestedDays: number;
}

// POST /api/requests (F-04)
export async function createBorrowRequest(input: NewRequest): Promise<BorrowRequest> {
  const res = await apiFetch<{ request: BorrowRequest }>('/api/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.request;
}

// GET /api/requests/mine (F-04)
export async function fetchMyRequests(): Promise<BorrowRequest[]> {
  const res = await apiFetch<{ requests: BorrowRequest[] }>('/api/requests/mine');
  if (!res || !Array.isArray(res.requests)) {
    throw new Error('Unexpected response from the server.');
  }
  return res.requests;
}

// POST /api/requests/:id/cancel (F-06)
export async function cancelBorrowRequest(id: number): Promise<BorrowRequest> {
  const res = await apiFetch<{ request: BorrowRequest }>(`/api/requests/${id}/cancel`, { method: 'POST' });
  return res.request;
}
