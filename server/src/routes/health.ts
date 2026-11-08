import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

// Process is alive (used by the Lab 5 smoke test).
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Database is reachable (used by the Lab 5 smoke test).
healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: 'connected' });
  } catch {
    res.status(503).json({ db: 'disconnected' });
  }
});
