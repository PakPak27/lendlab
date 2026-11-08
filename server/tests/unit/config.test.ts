// SYS-01 / NFR-09: settings come from the environment and are validated at startup.
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('reads values from the environment and applies defaults', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgresql://x' } as NodeJS.ProcessEnv);
    expect(cfg.DATABASE_URL).toBe('postgresql://x');
    expect(cfg.PORT).toBe(3000);
    expect(cfg.SESSION_TTL_HOURS).toBe(8);
    expect(cfg.NODE_ENV).toBe('development');
  });

  it('converts numeric strings', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgresql://x', PORT: '8080', SESSION_TTL_HOURS: '2' } as NodeJS.ProcessEnv);
    expect(cfg.PORT).toBe(8080);
    expect(cfg.SESSION_TTL_HOURS).toBe(2);
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'staging' } as NodeJS.ProcessEnv)).toThrow(/NODE_ENV/);
  });
});
