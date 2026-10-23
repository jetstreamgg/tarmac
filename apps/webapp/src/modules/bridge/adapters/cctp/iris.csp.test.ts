import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IRIS_API_URL } from './iris';

// The page's CSP meta tag is built in vite.config.ts; a blocked Iris keeps every CCTP bridge Pending.
const viteConfig = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'vite.config.ts'), 'utf8');

describe('Iris and the page CSP', () => {
  it('lets the page fetch attestations from Iris', () => {
    const connectSrc = viteConfig.match(/^\s*connect-src([^;]*);/m)?.[1].split(/\s+/) ?? [];
    expect(connectSrc).toContain(new URL(IRIS_API_URL).origin);
  });
});
