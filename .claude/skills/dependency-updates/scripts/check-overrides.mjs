#!/usr/bin/env node
// Reports which `overrides:` in pnpm-workspace.yaml are still doing something.
//
// It copies the workspace manifests and lockfile to a temp dir, deletes every override,
// re-resolves with `pnpm install --lockfile-only`, and checks each override's selector
// against what would be resolved without it. An override whose selector matches nothing
// is a removal candidate: dropping it would not bring back the version it targets.
// Read-only for the repo; needs network access to the registry.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/check-overrides.mjs
import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  WORKSPACE_FILE,
  lockfileChildVersions,
  lockfilePackages,
  parseOverrideSelector,
  readYaml,
  satisfies
} from './lib.mjs';

const run = promisify(execFile);

const workspace = readYaml(WORKSPACE_FILE);
const overrides = Object.entries(workspace.overrides ?? {});
if (!overrides.length) {
  console.log('No overrides in pnpm-workspace.yaml.');
  process.exit(0);
}

// Workspace package directories; only `dir/*` and plain `dir` globs are used in this repo.
function packageDirs() {
  return (workspace.packages ?? []).flatMap(glob => {
    if (glob.endsWith('/*')) {
      const root = glob.slice(0, -2);
      return readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')))
        .map(entry => join(root, entry.name));
    }
    if (/[*?{[]/.test(glob)) throw new Error(`Unsupported workspace glob: ${glob}`);
    return [glob];
  });
}

// Drops the top-level `overrides:` block, keeping everything else byte for byte.
function withoutOverrides(text) {
  const lines = text.split('\n');
  const start = lines.indexOf('overrides:');
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^\s/.test(lines[end]))) end++;
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}

const dir = mkdtempSync(join(tmpdir(), 'check-overrides-'));
try {
  const files = [
    'package.json',
    'pnpm-lock.yaml',
    '.npmrc',
    ...packageDirs().map(d => join(d, 'package.json'))
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    mkdirSync(join(dir, dirname(file)), { recursive: true });
    cpSync(file, join(dir, file));
  }
  writeFileSync(join(dir, WORKSPACE_FILE), withoutOverrides(readFileSync(WORKSPACE_FILE, 'utf8')));

  console.error('Re-resolving the lockfile without overrides (pnpm install --lockfile-only)...');
  try {
    await run('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      cwd: dir,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    throw new Error(`pnpm install --lockfile-only failed:\n${error.stderr || error.message}`, {
      cause: error
    });
  }

  const lockText = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
  const packages = lockfilePackages(lockText);
  const rows = overrides.map(([key, replacement]) => {
    const { parent, name, range } = parseOverrideSelector(key);
    if (!range)
      return { key, replacement, status: 'review', detail: 'unconditional override (no version selector)' };
    const resolved = parent
      ? lockfileChildVersions(lockText, parent, name)
      : (packages.get(name) ?? new Set());
    try {
      const hits = [...resolved].filter(version => satisfies(version, range));
      return hits.length
        ? { key, replacement, status: 'needed', detail: `would resolve ${hits.join(', ')}` }
        : {
            key,
            replacement,
            status: 'removable',
            detail: `nothing matches without it (resolved: ${[...resolved].join(', ') || 'none'})`
          };
    } catch (error) {
      return { key, replacement, status: 'review', detail: error.message };
    }
  });

  const order = { removable: 0, review: 1, needed: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status]);
  console.log('# Overrides check\n\n| Override | Replacement | Status | Detail |\n| --- | --- | --- | --- |');
  for (const r of rows) console.log(`| \`${r.key}\` | \`${r.replacement}\` | ${r.status} | ${r.detail} |`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
