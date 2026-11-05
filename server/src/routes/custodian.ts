import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { checkoutRequest, listPendingRequests } from '../services/checkoutService.js';

// Mounted under /api/custodian, which app.ts already protects with authenticate + requireRole('CUSTODIAN') (F-02).
export const custodianRouter = Router();

const idParams = z.object({
  // A positive integer that fits the database INT column, so a huge id is a 400 instead of a database error.
  id: z.coerce.number().int().positive().max(2_147_483_647),
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
