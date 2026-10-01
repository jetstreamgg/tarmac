#!/usr/bin/env node
// Plans the monthly dependency updates from the pnpm catalog and the dependabot rules.
// For every catalog entry it resolves the newest version that the dependabot ignore rules
// allow and that is older than minimumReleaseAge, then assigns it to a dependabot group.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/plan-updates.mjs [--json <file>]
//
// --json writes { groups: { <group>: ["pkg@version", ...] } } for bump-catalog.mjs.
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import {
  DEPENDABOT_FILE,
  STABLE_VERSION,
  WORKSPACE_FILE,
  bumpLevel,
  compareVersions,
  globMatch,
  parseYaml,
  readYaml,
  satisfies,
  splitRange
} from './lib.mjs';

const run = promisify(execFile);
const LEVELS = ['major', 'minor', 'patch'];
const CONCURRENCY = 8;

const requiredNode = Number(readFileSync('.nvmrc', 'utf8').trim());
const currentNode = Number(process.versions.node.split('.')[0]);
if (currentNode < requiredNode) {
  console.error(
    `Node ${process.versions.node} is older than .nvmrc (${requiredNode}). Put Node ${requiredNode} first on PATH for every command in this run.`
  );
  process.exit(1);
}

const jsonIndex = process.argv.indexOf('--json');
const jsonOut = jsonIndex === -1 ? null : process.argv[jsonIndex + 1];

const workspace = readYaml(WORKSPACE_FILE);
const npmConfig = readYaml(DEPENDABOT_FILE).updates.find(u => u['package-ecosystem'] === 'npm');
const minimumReleaseAge = Number(workspace.minimumReleaseAge ?? 0);
// Resolved versions per catalog entry, from the lockfile's `catalogs:` block.
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const catalogsBlock = /^catalogs:\n((?:[ \t].*\n|\n)*)/m.exec(lockfile)?.[1] ?? '';
const resolved = parseYaml(catalogsBlock).default ?? {};
const cutoff = Date.now() - minimumReleaseAge * 60_000;

// Dependabot puts an update in the first group whose patterns and update-types match.
const groups = Object.entries(npmConfig.groups ?? {}).map(([name, group]) => ({
  name,
  patterns: group.patterns ?? ['*'],
  excludePatterns: group['exclude-patterns'] ?? [],
  updateTypes: group['update-types'] ?? LEVELS
}));

function rulesFor(name) {
  const allowed = new Set(LEVELS);
  const excludedVersions = [];
  for (const rule of npmConfig.ignore ?? []) {
    if (!globMatch(rule['dependency-name'], name)) continue;
    const types = rule['update-types'];
    const versions = rule.versions;
    if (!types && !versions) return { ignored: true, allowed: new Set(), excludedVersions };
    for (const type of types ?? []) allowed.delete(type.replace('version-update:semver-', ''));
    if (versions) excludedVersions.push(...(Array.isArray(versions) ? versions : [versions]));
  }
  return { ignored: false, allowed, excludedVersions };
}

function groupFor(name, level) {
  const group = groups.find(
    g =>
      g.patterns.some(p => globMatch(p, name)) &&
      !g.excludePatterns.some(p => globMatch(p, name)) &&
      g.updateTypes.includes(level)
  );
  return group?.name ?? '(no group: individual PR)';
}

async function registryInfo(name) {
  const { stdout } = await run('npm', ['view', name, 'versions', 'time', '--json'], {
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

async function plan(name, range) {
  const parsed = splitRange(range);
  if (!parsed) return { name, skipped: `unsupported catalog range "${range}"` };
  const current = parsed.version;
  const rules = rulesFor(name);
  if (rules.ignored) return { name, skipped: 'ignored entirely by dependabot.yml' };

  const { versions, time } = await registryInfo(name);
  const newer = versions
    .filter(v => STABLE_VERSION.test(v) && compareVersions(v, current) > 0)
    .sort(compareVersions);
  if (!newer.length) return null;

  const latest = newer.at(-1);
  const isOldEnough = v => new Date(time[v]).getTime() < cutoff;
  const isExcluded = v => rules.excludedVersions.some(req => satisfies(v, req));
  const eligible = newer.filter(
    v => rules.allowed.has(bumpLevel(current, v)) && !isExcluded(v) && isOldEnough(v)
  );
  const target = eligible.at(-1);

  // Explain why `latest` is not the target, most specific reason first.
  let heldBack = null;
  if (target !== latest) {
    const level = bumpLevel(current, latest);
    if (!rules.allowed.has(level)) heldBack = `${level} (dependabot ignores ${level} for this package)`;
    else if (isExcluded(latest)) heldBack = 'excluded by a dependabot `versions` ignore rule';
    else if (!isOldEnough(latest))
      heldBack = `younger than minimumReleaseAge (published ${time[latest].slice(0, 10)})`;
    else heldBack = 'not eligible';
  }

  const level = target && bumpLevel(current, target);
  const notes = [];
  // Under semver a 0.x minor is breaking, but dependabot still classifies it as minor.
  if (level === 'minor' && current.startsWith('0.')) notes.push('0.x minor: breaking under semver, review');
  if (parsed.prefix === '') notes.push('exact pin');
  const installed = resolved[name]?.version;
  // The lockfile can already resolve the target when the range allows it: only the floor moves.
  const floorOnly = Boolean(target && installed && compareVersions(installed, target) >= 0);

  return {
    name,
    prefix: parsed.prefix,
    current,
    target: target ?? null,
    level,
    group: target ? groupFor(name, level) : null,
    latest,
    heldBack,
    floorOnly,
    installed,
    notes
  };
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const entries = Object.entries(workspace.catalog ?? {});
const results = (await mapLimit(entries, CONCURRENCY, ([name, range]) => plan(name, range))).filter(Boolean);

const bumps = results.filter(r => r.target && !r.floorOnly);
const floorOnly = results.filter(r => r.floorOnly);
const held = results.filter(r => r.heldBack);
const skipped = results.filter(r => r.skipped);

const byGroup = new Map(groups.map(g => [g.name, []]));
for (const bump of bumps) {
  if (!byGroup.has(bump.group)) byGroup.set(bump.group, []);
  byGroup.get(bump.group).push(bump);
}

const cell = r => `${r.prefix}${r.current}`;
console.log(
  `# Dependency update plan\n\nCutoff: published before ${new Date(cutoff).toISOString()} (minimumReleaseAge ${minimumReleaseAge} min)\n`
);
for (const [group, items] of byGroup) {
  if (!items.length) continue;
  console.log(`## ${group}\n\n| Package | From | To | Level | Notes |\n| --- | --- | --- | --- | --- |`);
  for (const r of items) {
    console.log(`| ${r.name} | ${cell(r)} | ${r.prefix}${r.target} | ${r.level} | ${r.notes.join('; ')} |`);
  }
  console.log(
    `\nApply: node .claude/skills/dependency-updates/scripts/bump-catalog.mjs ${items.map(r => `${r.name}@${r.target}`).join(' ')}\n`
  );
}
if (floorOnly.length) {
  console.log(
    '## Floor-only (lockfile already resolves the target; not an update, not in the apply commands)\n\n| Package | Catalog | Installed |\n| --- | --- | --- |'
  );
  for (const r of floorOnly) console.log(`| ${r.name} | ${cell(r)} | ${r.installed} |`);
  console.log('');
}
if (held.length) {
  console.log(
    '## Held back (newer version exists)\n\n| Package | Current | Latest | Planned | Why latest is not taken |\n| --- | --- | --- | --- | --- |'
  );
  for (const r of held)
    console.log(`| ${r.name} | ${cell(r)} | ${r.latest} | ${r.target ?? 'none'} | ${r.heldBack} |`);
  console.log('');
}
if (skipped.length) {
  console.log('## Skipped\n');
  for (const r of skipped) console.log(`- ${r.name}: ${r.skipped}`);
}

if (jsonOut) {
  const json = {
    groups: Object.fromEntries(
      [...byGroup]
        .filter(([, items]) => items.length)
        .map(([group, items]) => [group, items.map(r => `${r.name}@${r.target}`)])
    )
  };
  writeFileSync(jsonOut, `${JSON.stringify(json, null, 2)}\n`);
}
