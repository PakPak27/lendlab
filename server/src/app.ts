import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getConfig } from './config.js';
import { healthRouter } from './routes/health.js';
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
  // Feature routers are added here by Issues #4-#8.

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
