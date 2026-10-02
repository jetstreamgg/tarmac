#!/usr/bin/env node
// Reports which `overrides:` in pnpm-workspace.yaml are still doing something.
//
// Pass 1 copies the workspace manifests and lockfile to a temp dir, deletes every override,
// re-resolves with `pnpm install --lockfile-only`, and checks each override's selector
// against the result. Pass 2 confirms the removal candidates against the tree you'd
// actually get: every other override kept, only the candidates deleted. A candidate that
// matches nothing in pass 2 is `removable`: dropping it can't bring back the version it
// targets. Read-only for the repo; needs network access to the registry.
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
  filterOverrides,
  lockfileChildVersions,
  lockfilePackages,
  parseOverrideSelector,
  readYaml,
  satisfies,
  workspaceManifests
} from './lib.mjs';

const run = promisify(execFile);

const workspaceText = readFileSync(WORKSPACE_FILE, 'utf8');
const workspace = readYaml(WORKSPACE_FILE);
const overrides = Object.entries(workspace.overrides ?? {});
if (!overrides.length) {
  console.log('No overrides in pnpm-workspace.yaml.');
  process.exit(0);
}

const manifests = workspaceManifests(workspace, {
  exists: existsSync,
  listDirs: root =>
    readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
});

/** Re-resolves the lockfile in a temp copy that keeps only the overrides in `keep`. */
async function resolveWithOverrides(keep) {
  const dir = mkdtempSync(join(tmpdir(), 'check-overrides-'));
  try {
    for (const file of ['pnpm-lock.yaml', '.npmrc', ...manifests]) {
      if (!existsSync(file)) continue;
      mkdirSync(join(dir, dirname(file)), { recursive: true });
      cpSync(file, join(dir, file));
    }
    writeFileSync(
      join(dir, WORKSPACE_FILE),
      filterOverrides(workspaceText, key => keep.has(key))
    );
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
    return readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** What `key`'s selector matches in a lockfile: `needed`, `absent`, `unmatched` or `review`. */
function evaluate(lockText, key) {
  const { parent, name, range } = parseOverrideSelector(key);
  if (!range) return { state: 'review', detail: 'unconditional override (no version selector)' };
  const resolved = parent
    ? lockfileChildVersions(lockText, parent, name)
    : lockfilePackages(lockText).get(name);
  if (!resolved?.size) {
    const where = parent ? `${name} under ${parent}` : name;
    return { state: 'absent', detail: `${where} is not in the re-resolved lockfile` };
  }
  try {
    const hits = [...resolved].filter(version => satisfies(version, range));
    return hits.length
      ? { state: 'needed', detail: `would resolve ${hits.join(', ')}` }
      : { state: 'unmatched', detail: `nothing matches without it (resolved: ${[...resolved].join(', ')})` };
  } catch (error) {
    return { state: 'review', detail: error.message };
  }
}

try {
  console.error('Pass 1: re-resolving the lockfile without any overrides...');
  const withoutAll = await resolveWithOverrides(new Set());
  const rows = overrides.map(([key, replacement]) => {
    const { state, detail } = evaluate(withoutAll, key);
    // A selector that matches no package at all could also be a parse or name mismatch, so it
    // is never reported as safe to delete without a human look.
    const status = { needed: 'needed', unmatched: 'removable', absent: 'review', review: 'review' }[state];
    return { key, replacement, status, detail };
  });

  const candidates = rows.filter(r => r.status === 'removable');
  if (candidates.length) {
    console.error(
      `Pass 2: re-resolving with the other overrides kept and ${candidates.length} candidates removed...`
    );
    const keep = new Set(rows.filter(r => r.status !== 'removable').map(r => r.key));
    const withKept = await resolveWithOverrides(keep);
    for (const row of candidates) {
      const { state, detail } = evaluate(withKept, row.key);
      if (state === 'needed')
        [row.status, row.detail] = ['needed', `${detail} once the kept overrides apply`];
      else if (state === 'review') [row.status, row.detail] = ['review', detail];
      else if (state === 'absent') row.detail = 'not in the tree once the candidates are removed';
    }
  }

  const order = { removable: 0, review: 1, needed: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status]);
  console.log('# Overrides check\n\n| Override | Replacement | Status | Detail |\n| --- | --- | --- | --- |');
  for (const r of rows) console.log(`| \`${r.key}\` | \`${r.replacement}\` | ${r.status} | ${r.detail} |`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
