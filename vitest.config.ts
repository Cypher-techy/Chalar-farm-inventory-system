import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    // Tests use the labelled demo data set as fixtures.
    env: { ENABLE_DEMO_SEED: 'true' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
