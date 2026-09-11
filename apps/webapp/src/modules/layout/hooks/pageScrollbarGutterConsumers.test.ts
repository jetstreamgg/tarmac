import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Source-scan guard for the two scroll-lock tokens (globals.css, the
// `--page-released-gutter` comment): a viewport-anchored layer that reads one
// of them into an inset must not transition that inset, or it glides sideways
// when the lock flips instead of snapping with the scrollport. Tailwind's
// `duration-*` / `ease-*` variants set transition-duration/-timing-function
// as well as the animation ones, so any file that pairs a token with a
// duration variant has to narrow or kill the transition explicitly. Both
// regressions (the dialog rising on a diagonal, ToastCloseAll drifting under
// the toasts) came back this way once already.

const SRC = join(__dirname, '..', '..', '..');
const TOKENS = /--page-(released|scrollbar)-gutter/;
const DURATION = /\bduration-\d/;
const TRANSITION_NARROWED = /\btransition-(none|transform|colors|opacity|shadow)\b/;

// Comments explain these very rules, so they would satisfy the regexes; only
// code (class strings) counts.
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'test') walk(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe('scroll-lock gutter token consumers', () => {
  const consumers = walk(SRC).filter(f => TOKENS.test(stripComments(readFileSync(f, 'utf8'))));

  it('finds the known consumers', () => {
    expect(consumers.length).toBeGreaterThan(3);
  });

  it.each(consumers.map(f => [relative(SRC, f), f]))(
    '%s does not transition the inset it reads a token into',
    (_name, file) => {
      const source = stripComments(readFileSync(file, 'utf8'));
      if (DURATION.test(source)) {
        expect(source, 'pairs a duration variant with a lock token; add transition-none').toMatch(
          TRANSITION_NARROWED
        );
      }
    }
  );
});
