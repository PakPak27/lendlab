import type { Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { statusChangeError, type ManualStatus } from '../lib/itemStatus.js';
import { prisma } from '../lib/prisma.js';
import { isUniqueViolation } from '../lib/prismaErrors.js';
import type { CreateItemInput, UpdateItemInput } from '../schemas/inventorySchemas.js';
import type { AuthUser } from './authService.js';

// F-10 Inventory management (contract docs/sprints/sprint-2/F-10-inventory.md).

const inventorySelect = {
  id: true,
  assetTag: true,
  name: true,
  description: true,
  status: true,
  category: { select: { id: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ItemSelect;

const fieldError = (field: string, message: string) =>
  new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', [{ field, message }]);

const STATUS_MESSAGES = {
  ITEM_IN_USE: 'This item has a pending request or an active loan, so its status cannot be changed.',
  ITEM_RETIRED: 'This item is retired and cannot be changed.',
  INVALID_STATUS_CHANGE: 'The item already has this status.',
} as const;

// BR-05: only items in the custodian's assigned locations (D-06: outside = not found).
const inScope = (user: AuthUser): Prisma.ItemWhereInput => ({ locationId: { in: user.locationIds } });

async function checkReferences(user: AuthUser, input: { categoryId?: number; locationId?: number }) {
  if (input.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) throw fieldError('categoryId', 'Choose an existing category.');
  }
  if (input.locationId !== undefined && !user.locationIds.includes(input.locationId)) {
    throw fieldError('locationId', 'You can only use your own locations.');
  }
}

// FR-13: all items in the custodian's locations, every status, name order.
export async function listInventory(user: AuthUser) {
  const items = await prisma.item.findMany({
    where: inScope(user),
    select: inventorySelect,
    orderBy: [{ name: 'asc' }, { assetTag: 'asc' }],
  });
  return { items };
}

// FR-13: add a new Available item to one of the custodian's locations.
export async function createItem(user: AuthUser, input: CreateItemInput) {
  await checkReferences(user, input);
  try {
    const item = await prisma.item.create({
      data: {
        assetTag: input.assetTag,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId,
        locationId: input.locationId,
      },
      select: inventorySelect,
    });
    return { item };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'ASSET_TAG_TAKEN', 'This asset tag is already used.');
    throw err;
  }
}

// FR-13: edit details of an item in the custodian's locations (the asset tag is fixed).
export async function updateItem(user: AuthUser, id: number, input: UpdateItemInput) {
  const found = await prisma.item.findFirst({ where: { id, ...inScope(user) }, select: { id: true } });
  if (!found) throw notFound();
  await checkReferences(user, input);
  const item = await prisma.item.update({ where: { id }, data: input, select: inventorySelect });
  return { item };
}

// FR-14 / BR-13: Available <-> Maintenance, either -> Retired. The update is conditional on the status we
// checked, so a request that reserves the item at the same moment makes this change fail with 409.
export async function changeItemStatus(user: AuthUser, id: number, to: ManualStatus) {
  const found = await prisma.item.findFirst({ where: { id, ...inScope(user) }, select: { id: true, status: true } });
  if (!found) throw notFound();

  const refused = statusChangeError(found.status, to);
  if (refused) throw new AppError(409, refused, STATUS_MESSAGES[refused]);

  const changed = await prisma.item.updateMany({ where: { id, status: found.status }, data: { status: to } });
  if (changed.count === 0) throw new AppError(409, 'ITEM_IN_USE', STATUS_MESSAGES.ITEM_IN_USE);

  const item = await prisma.item.findUniqueOrThrow({ where: { id }, select: inventorySelect });
  return { item };
}
