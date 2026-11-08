import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { CATALOG_STATUSES, getCatalogItem, listCatalogItems } from '../services/itemService.js';

// F-03 Equipment Catalog. Mounted under /api/items, which app.ts already guards with `authenticate` (F-02).
export const itemsRouter = Router();

const listQuery = z.object({
  status: z
    .enum(CATALOG_STATUSES, {
      errorMap: () => ({ message: `Status must be one of ${CATALOG_STATUSES.join(', ')}.` }),
    })
    .optional(),
});

const idParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, 'Item id must be a positive whole number.')
    .transform(Number)
    // Must fit the database INT column, otherwise a huge id is a 500 instead of a 400.
    .refine((n) => n <= 2_147_483_647, 'Item id is too large.'),
});

itemsRouter.get('/', validate(listQuery, 'query'), async (req, res, next) => {
  try {
    const { status } = req.query as z.infer<typeof listQuery>;
    res.json({ items: await listCatalogItems(status) });
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/:id', validate(idParams, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    res.json({ item: await getCatalogItem(id) });
  } catch (err) {
    next(err);
  }
});
