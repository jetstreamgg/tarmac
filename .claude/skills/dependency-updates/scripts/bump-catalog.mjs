#!/usr/bin/env node
// Sets catalog versions in pnpm-workspace.yaml, keeping each entry's `^`, `~` or exact style.
// Only the `catalog:` block is edited, never `overrides:`. Run `pnpm install` afterwards.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/bump-catalog.mjs viem@2.56.8 @wagmi/core@3.6.5
import { readFileSync, writeFileSync } from 'node:fs';
import { WORKSPACE_FILE } from './lib.mjs';

const specs = process.argv.slice(2);
if (!specs.length) {
  console.error('Usage: bump-catalog.mjs <pkg@version> [...]');
  process.exit(1);
}

const lines = readFileSync(WORKSPACE_FILE, 'utf8').split('\n');
const start = lines.indexOf('catalog:');
if (start === -1) throw new Error(`No top-level catalog: block in ${WORKSPACE_FILE}`);
let end = start + 1;
while (end < lines.length && (lines[end] === '' || lines[end].startsWith(' '))) end++;

for (const spec of specs) {
  const at = spec.lastIndexOf('@');
  const [name, version] = [spec.slice(0, at), spec.slice(at + 1)];
  if (at <= 0 || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Expected <pkg@x.y.z>, got "${spec}"`);

  const index = lines.findIndex((line, i) => {
    if (i <= start || i >= end) return false;
    const match = /^ {2}(?:'([^']+)'|"([^"]+)"|([^:'"]+)):/.exec(line);
    return match && (match[1] ?? match[2] ?? match[3]) === name;
  });
  if (index === -1) throw new Error(`${name} is not in the catalog`);

  const match = /^(.*?: )([~^]?)\d+\.\d+\.\d+$/.exec(lines[index]);
  if (!match) throw new Error(`Unsupported catalog range on line: ${lines[index]}`);
  lines[index] = `${match[1]}${match[2]}${version}`;
  console.log(`${name}: ${match[2]}${version}`);
}

writeFileSync(WORKSPACE_FILE, lines.join('\n'));
