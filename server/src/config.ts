import 'dotenv/config';
import { z } from 'zod';

// Every setting is read from the environment (NFR-09).
// The server refuses to start if a required value is missing or invalid.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(8),
  CORS_ORIGIN: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return parsed.data;
}

// Loaded on first use (not at import time) so unit tests can import this module
// without a real environment.
let cached: AppConfig | undefined;
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
