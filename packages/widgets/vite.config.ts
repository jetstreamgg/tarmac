/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react-swc';
import { configDefaults } from 'vitest/config';
import { lingui } from '@lingui/vite-plugin';
import pkg from './package.json';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Construct the regular expresion with the caret (^) to avoid matching local file imports
const externalDeps = pkg['dependencies']
  ? Object.keys(pkg['dependencies']).map(dep => new RegExp('^' + dep))
  : [];
const externalPeerDeps = pkg['peerDependencies']
  ? Object.keys(pkg['peerDependencies']).map(dep => new RegExp('^' + dep))
  : [];

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    sourcemap: true,
    target: ['es2020'],
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'jetstream-gg-sky-widgets',
      fileName: 'jetstream-gg-sky-widgets',
      cssFileName: 'globals',
      formats: ['es']
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [...externalDeps, ...externalPeerDeps],
      output: {
        // Add this configuration for better source maps
        sourcemapExcludeSources: false
      }
    }
  },
  test: {
    exclude: [...configDefaults.exclude],
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts']
  },
  resolve: {
    alias: {
      '@widgets': resolve(__dirname, './src')
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['src/locales', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
      copyDtsFiles: true
    }),
    react({
      plugins: [['@lingui/swc-plugin', {}]]
    }),
    tailwindcss(),
    lingui(),
    visualizer(),
    viteStaticCopy({
      targets: [{ src: 'src/public/fonts/*', dest: 'fonts' }]
    })
  ]
});
