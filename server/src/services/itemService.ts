import type { ItemStatus, Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

// F-03 Equipment Catalog. Read-only; visible to every signed-in user.
// Privacy (contract section 3): only the item's own status is returned, never who requested or borrowed it.

// Statuses that may be used as a catalog filter. RETIRED items never appear in the catalog.
export const CATALOG_STATUSES = ['AVAILABLE', 'RESERVED', 'ON_LOAN', 'MAINTENANCE'] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

const catalogSelect = {
  id: true,
  assetTag: true,
  name: true,
  status: true,
  category: { select: { id: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ItemSelect;

const notRetired: Prisma.ItemWhereInput = { status: { not: 'RETIRED' satisfies ItemStatus } };

export async function listCatalogItems(status?: CatalogStatus) {
  const items = await prisma.item.findMany({
    where: status ? { status } : notRetired,
    select: catalogSelect,
    orderBy: [{ name: 'asc' }, { assetTag: 'asc' }],
  });
  // Fixed key order in the response: id, assetTag, name, category, location, status.
  return items.map(({ id, assetTag, name, category, location, status: s }) => ({
    id,
    assetTag,
    name,
    category,
    location,
    status: s,
  }));
}

export async function getCatalogItem(id: number) {
  const item = await prisma.item.findFirst({
    where: { id, ...notRetired },
    select: { ...catalogSelect, description: true },
  });
  if (!item) {
    throw new AppError(404, 'ITEM_NOT_FOUND', 'The requested item was not found.');
  }
  return item;
}

export async function listCategories() {
  return prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}
