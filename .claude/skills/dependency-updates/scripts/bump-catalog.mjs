#!/usr/bin/env node
// Sets catalog versions in pnpm-workspace.yaml, keeping each entry's `^`, `~` or exact style.
// Only the `catalog:` block is edited, never `overrides:`. Every argument is validated
// before anything is written, and a version that isn't newer than the current one is
// refused. Run `pnpm install` afterwards.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/bump-catalog.mjs viem@2.56.8 @wagmi/core@3.6.5
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_LINE_RE, STABLE_VERSION, WORKSPACE_FILE, compareVersions, splitRange } from './lib.mjs';

const specs = process.argv.slice(2);
if (!specs.length) {
  console.error('Usage: bump-catalog.mjs <pkg@version> [...]');
  process.exit(1);
}

const text = readFileSync(WORKSPACE_FILE, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);
const start = lines.indexOf('catalog:');
if (start === -1) throw new Error(`No top-level catalog: block in ${WORKSPACE_FILE}`);
let end = start + 1;
while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end++;

for (const spec of specs) {
  const at = spec.lastIndexOf('@');
  const [name, version] = [spec.slice(0, at), spec.slice(at + 1)];
  if (at <= 0 || !STABLE_VERSION.test(version)) throw new Error(`Expected <pkg@x.y.z>, got "${spec}"`);

  let index = -1;
  let match = null;
  for (let i = start + 1; i < end; i++) {
    const m = CATALOG_LINE_RE.exec(lines[i]);
    if (m && (m[1] ?? m[2] ?? m[3]) === name) [index, match] = [i, m];
  }
  if (index === -1) throw new Error(`${name} is not in the catalog`);

  const range = splitRange(match[4].trim());
  if (!range) throw new Error(`Unsupported catalog range for ${name}: ${match[4]}`);
  if (compareVersions(version, range.version) <= 0) {
    throw new Error(`${name}@${version} is not newer than the catalog's ${range.prefix}${range.version}`);
  }
  lines[index] = lines[index].replace(/[~^]?\d+\.\d+\.\d+\s*$/, `${range.prefix}${version}`);
  console.log(`${name}: ${range.prefix}${range.version} -> ${range.prefix}${version}`);
}

writeFileSync(WORKSPACE_FILE, lines.join(eol));
