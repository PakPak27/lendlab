import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getConfig } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { itemsRouter } from './routes/items.js';
import { requestsRouter } from './routes/requests.js';
import { authenticate } from './middleware/authenticate.js';
import { requireRole } from './middleware/requireRole.js';
import { custodianRouter } from './routes/custodian.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';

// Builds the Express app without starting it, so tests can import it.
export function createApp() {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  if (config.CORS_ORIGIN) {
    app.use(cors({ origin: config.CORS_ORIGIN }));
  }

  // Request log: method, path, status, duration. Never logs bodies, tokens, or passwords.
  if (config.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  // --- API routes ---
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', categoriesRouter); // public (AC-03-04)

  // F-02: access guards. Order is 401 (authenticate) -> 403 (role) -> 404 (record scope) -> 409 (business rule).
  // They sit in front of the feature routers below, so a feature cannot forget them.
  app.use('/api/items', authenticate);
  app.use('/api/requests', authenticate, requireRole('BORROWER')); // BR-07: custodians cannot create or read borrower requests
  app.use('/api/custodian', authenticate, requireRole('CUSTODIAN')); // BR-07: borrowers cannot use custodian operations

  // Feature routers (each behind the guards above).
  app.use('/api/items', itemsRouter); // F-03
  app.use('/api/requests', requestsRouter); // F-04
  app.use('/api/custodian', custodianRouter); // F-05

  app.use('/api', apiNotFound);

  // --- Built React app (production, Lab 5) ---
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
