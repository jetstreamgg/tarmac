import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    dedupe: ['wagmi', 'viem', '@tanstack/react-query', 'react', 'react-dom']
  },
  test: {
    include: ['src/hooks/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom',
    testTimeout: 90000,
    hookTimeout: 30000,
    setupFiles: ['./src/test/blankForkEnv.ts', './test/hooks/setup.ts'],
    globalSetup: ['./test/hooks/globalSetup.ts'],
    pool: 'forks',
    maxWorkers: 1
  }
});
