import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // API tests share one real test database, so test files must not run in parallel.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
