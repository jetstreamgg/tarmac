#!/usr/bin/env node
// Sets catalog versions in pnpm-workspace.yaml, keeping each entry's `^`, `~` or exact style
// and any trailing comment. Only the `catalog:` block is edited, never `overrides:`. Every
// argument is validated before anything is written, and a version that isn't newer than the
// current one is refused. Run `pnpm install` afterwards.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/bump-catalog.mjs viem@2.56.8 @wagmi/core@3.6.5
import { readFileSync, writeFileSync } from 'node:fs';
import { WORKSPACE_FILE, bumpCatalogText } from './lib.mjs';

const specs = process.argv.slice(2);
if (!specs.length) {
  console.error('Usage: bump-catalog.mjs <pkg@version> [...]');
  process.exit(1);
}

const { text, changes } = bumpCatalogText(readFileSync(WORKSPACE_FILE, 'utf8'), specs);
writeFileSync(WORKSPACE_FILE, text);
for (const { name, from, to } of changes) console.log(`${name}: ${from} -> ${to}`);
