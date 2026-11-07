import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createRequestSchema, requestIdParams, type CreateRequestInput } from '../schemas/requestSchemas.js';
import { createRequest, getMyRequest, listMyRequests } from '../services/requestService.js';

// F-04 Borrow Request and My Borrowing. Mounted under /api/requests, which app.ts already
// guards with `authenticate` + `requireRole('BORROWER')` (F-02), so req.user is always a borrower.
export const requestsRouter = Router();

requestsRouter.post('/', validate(createRequestSchema), async (req, res, next) => {
  try {
    const request = await createRequest(req.user!, req.body as CreateRequestInput);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

// Must be declared before '/:id' so "mine" is not treated as an id.
requestsRouter.get('/mine', async (req, res, next) => {
  try {
    res.json({ requests: await listMyRequests(req.user!) });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get('/:id', validate(requestIdParams, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as { id: number };
    res.json({ request: await getMyRequest(req.user!, id) });
  } catch (err) {
    next(err);
  }
});
