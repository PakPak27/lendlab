import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { rejectRequestSchema } from '../schemas/requestSchemas.js';
import { checkoutRequest, listPendingRequests, rejectRequest } from '../services/checkoutService.js';

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
