import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getConfig } from '../config.js';

export const healthRouter = Router();

// Process is alive, and which commit is running (Lab 5 smoke test, R-08).
// GIT_SHA is set by the deploy pipeline; a local run reports "local".
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', commit: getConfig().GIT_SHA || 'local' });
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
