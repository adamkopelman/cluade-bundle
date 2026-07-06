import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Required: process.chdir() in tests/unit/commands/init.test.ts is unsupported in worker threads pool
    pool: 'forks',
  },
});
