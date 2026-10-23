import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    dedupe: ['wagmi', '@wagmi/core', 'viem', '@tanstack/react-query', 'react', 'react-dom']
  },
  test: {
    include: ['src/hooks/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom',
    // Same chains as the mock wallet build: the Tenderly mainnet fork plus L2 forks under their real ids.
    env: { VITE_USE_MOCK_WALLET: 'true' },
    testTimeout: 90000,
    hookTimeout: 30000,
    setupFiles: ['./test/hooks/setup.ts'],
    globalSetup: ['./test/hooks/globalSetup.ts'],
    pool: 'forks',
    maxWorkers: 1
  }
});
