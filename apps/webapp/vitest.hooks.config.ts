import path from 'path';
import { lingui } from '@lingui/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Hooks reach the revert registry (lib/revertMessages), whose copy is Lingui `msg` macros.
  plugins: [lingui({ macroTransform: true })],
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
    setupFiles: ['./test/hooks/setup.ts'],
    globalSetup: ['./test/hooks/globalSetup.ts'],
    pool: 'forks',
    maxWorkers: 1
  }
});
