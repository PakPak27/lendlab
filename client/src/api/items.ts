import { apiFetch } from './client';

export type ItemStatus = 'AVAILABLE' | 'RESERVED' | 'ON_LOAN' | 'MAINTENANCE';

export interface CatalogItem {
  id: number;
  assetTag: string;
  name: string;
  category: { id: number; name: string };
  location: { id: number; code: string; name: string };
  status: ItemStatus;
}

// GET /api/items (F-03). `status` is optional; empty means all non-retired items.
export async function fetchCatalog(status?: ItemStatus | ''): Promise<CatalogItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiFetch<{ items: CatalogItem[] }>(`/api/items${query}`);
  if (!res || !Array.isArray(res.items)) {
    throw new Error('Unexpected response from the server.');
  }
  return res.items;
}

export interface CatalogItemDetail extends CatalogItem {
  description: string | null;
}

// GET /api/items/:id (F-03). Throws ApiError 404 ITEM_NOT_FOUND for unknown or retired items.
export async function fetchItem(id: number): Promise<CatalogItemDetail> {
  const res = await apiFetch<{ item: CatalogItemDetail }>(`/api/items/${id}`);
  if (!res || !res.item) {
    throw new Error('Unexpected response from the server.');
  }
  return res.item;
}
