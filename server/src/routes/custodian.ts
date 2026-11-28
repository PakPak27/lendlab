import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { rejectRequestSchema } from '../schemas/requestSchemas.js';
import { checkoutRequest, listPendingRequests, rejectRequest } from '../services/checkoutService.js';
import { listActiveLoans, returnLoan } from '../services/loanService.js';
import { createItemSchema, itemStatusSchema, updateItemSchema } from '../schemas/inventorySchemas.js';
import { changeItemStatus, createItem, listInventory, updateItem } from '../services/inventoryService.js';

// Mounted under /api/custodian, which app.ts already protects with authenticate + requireRole('CUSTODIAN') (F-02).
export const custodianRouter = Router();

const idParams = z.object({
  // Plain digits only (no "1e3", spaces or leading zeros, same rule as the catalog and request ids), and small
  // enough for the database INT column, so a huge id is a 400 instead of a database error.
  id: z
    .string()
    .regex(/^[1-9]\d*$/, 'Request id must be a positive whole number.')
    .transform(Number)
    .refine((n) => n <= 2_147_483_647, 'Request id is too large.'),
});

// Sprint 1 supports PENDING only (default).
const queueQuery = z.object({ status: z.literal('PENDING').optional() });

custodianRouter.get('/requests', validate(queueQuery, 'query'), async (req, res, next) => {
  try {
    res.json(await listPendingRequests(req.user!));
  } catch (err) {
    next(err);
  }
});

custodianRouter.post('/requests/:id/checkout', validate(idParams, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    res.status(201).json(await checkoutRequest(req.user!, id));
  } catch (err) {
    next(err);
  }
});

// F-06: reject a pending request with a reason (BR-09).
custodianRouter.post(
  '/requests/:id/reject',
  validate(idParams, 'params'),
  validate(rejectRequestSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParams>;
      const { reason } = req.body as z.infer<typeof rejectRequestSchema>;
      res.json(await rejectRequest(req.user!, id, reason));
    } catch (err) {
      next(err);
    }
  },
);

// F-07: active loans in the custodian's locations (FR-19) and recording a return (FR-11, BR-10).
const returnBody = z
  .object({ needsMaintenance: z.boolean({ invalid_type_error: 'Needs maintenance must be true or false.' }).optional() })
  .strict();

custodianRouter.get('/loans', async (req, res, next) => {
  try {
    res.json(await listActiveLoans(req.user!));
  } catch (err) {
    next(err);
  }
});

custodianRouter.post('/loans/:id/return', validate(idParams, 'params'), validate(returnBody), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParams>;
    const { needsMaintenance } = req.body as z.infer<typeof returnBody>;
    res.json(await returnLoan(req.user!, id, needsMaintenance ?? false));
  } catch (err) {
    next(err);
  }
});

// F-10: inventory of the custodian's locations (FR-13, FR-14, BR-13).
const itemIdParams = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, 'Item id must be a positive whole number.')
    .transform(Number)
    .refine((n) => n <= 2_147_483_647, 'Item id is too large.'),
});

custodianRouter.get('/items', async (req, res, next) => {
  try {
    res.json(await listInventory(req.user!));
  } catch (err) {
    next(err);
  }
});

custodianRouter.post('/items', validate(createItemSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createItem(req.user!, req.body as z.infer<typeof createItemSchema>));
  } catch (err) {
    next(err);
  }
});

custodianRouter.patch('/items/:id', validate(itemIdParams, 'params'), validate(updateItemSchema), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof itemIdParams>;
    res.json(await updateItem(req.user!, id, req.body as z.infer<typeof updateItemSchema>));
  } catch (err) {
    next(err);
  }
});

custodianRouter.post('/items/:id/status', validate(itemIdParams, 'params'), validate(itemStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof itemIdParams>;
    const { status } = req.body as z.infer<typeof itemStatusSchema>;
    res.json(await changeItemStatus(req.user!, id, status));
  } catch (err) {
    next(err);
  }
});
