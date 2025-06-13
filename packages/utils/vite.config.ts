// vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json';
import { visualizer } from 'rollup-plugin-visualizer';

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
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'jetstream-gg-sky-utils',
      fileName: 'jetstream-gg-sky-utils',
      formats: ['es']
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [...externalDeps, ...externalPeerDeps],
      output: {
        sourcemapExcludeSources: false
      }
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      copyDtsFiles: true,
      exclude: ['src/**/*.stories.ts, src/**/*.test.ts, src/**/*.test.tsx']
    }),
    visualizer()
  ]
});
