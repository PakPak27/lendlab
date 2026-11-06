import { Router } from 'express';
import { listCategories } from '../services/itemService.js';

// F-03 / AC-03-04: public category list (plain array). The Lab 5 smoke test reads it without signing in.
export const categoriesRouter = Router();

categoriesRouter.get('/categories', async (_req, res, next) => {
  try {
    res.json(await listCategories());
  } catch (err) {
    next(err);
  }
});
