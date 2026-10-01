#!/usr/bin/env node
// Plans the monthly dependency updates from the pnpm catalog and the dependabot rules.
// For every catalog entry it resolves the newest version that the dependabot ignore rules
// allow and that is older than minimumReleaseAge, then assigns it to a dependabot group.
// Read-only: it never writes to the repo.
//
// Usage (from the repo root):
//   node .claude/skills/dependency-updates/scripts/plan-updates.mjs
//
// Exits 1 (after printing what it could) if any package could not be planned, so a
// broken rule or registry error never passes for "nothing to update".
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import {
  DEPENDABOT_FILE,
  STABLE_VERSION,
  WORKSPACE_FILE,
  bumpLevel,
  compareVersions,
  globMatch,
  parseYaml,
  patternSpecificity,
  readYaml,
  satisfies,
  splitRange
} from './lib.mjs';

const run = promisify(execFile);
const LEVELS = ['major', 'minor', 'patch'];
const CONCURRENCY = 8;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readConfig(file) {
  try {
    return readYaml(file);
  } catch (error) {
    return fail(`${file}: ${error.message}`);
  }
}

const nvmrc = readFileSync('.nvmrc', 'utf8').trim();
const requiredNode = Number(/^v?(\d+)/.exec(nvmrc)?.[1]);
if (Number.isNaN(requiredNode)) fail(`Cannot read a Node major version from .nvmrc ("${nvmrc}").`);
const currentNode = Number(process.versions.node.split('.')[0]);
if (currentNode < requiredNode) {
  fail(
    `Node ${process.versions.node} is older than .nvmrc (${nvmrc}). Put Node ${requiredNode} first on PATH for every command in this run.`
  );
}

const workspace = readConfig(WORKSPACE_FILE);
if (workspace.catalogs) fail(`Named catalogs (\`catalogs:\`) in ${WORKSPACE_FILE} are not supported.`);
const catalog = Object.entries(workspace.catalog ?? {});
if (!catalog.length) fail(`No catalog entries found in ${WORKSPACE_FILE}.`);
if (workspace.minimumReleaseAge === undefined) {
  fail(`minimumReleaseAge is missing from ${WORKSPACE_FILE}; refusing to plan without the age gate.`);
}
const minimumReleaseAge = Number(workspace.minimumReleaseAge);
if (!Number.isFinite(minimumReleaseAge))
  fail(`minimumReleaseAge is not a number: ${workspace.minimumReleaseAge}`);
const ageExcludes = workspace.minimumReleaseAgeExclude ?? [];
const cutoff = Date.now() - minimumReleaseAge * 60_000;

// Resolved versions per catalog entry, from the lockfile's `catalogs:` block.
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const catalogsBlock = /^catalogs:\r?\n((?:[ \t].*\r?\n|\r?\n)*)/m.exec(lockfile)?.[1];
const resolved = catalogsBlock ? (parseYaml(catalogsBlock).default ?? {}) : {};
if (!Object.keys(resolved).length) {
  fail('pnpm-lock.yaml has no resolved `catalogs: default:` entries. Run `pnpm install` first.');
}

const npmConfig = readConfig(DEPENDABOT_FILE).updates?.find(u => u['package-ecosystem'] === 'npm');
if (!npmConfig) fail(`No npm entry in ${DEPENDABOT_FILE}.`);

const groups = Object.entries(npmConfig.groups ?? {})
  .filter(([, group]) => (group['applies-to'] ?? 'version-updates') === 'version-updates')
  .map(([name, group]) => ({
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

// Dependabot puts an update in the matching group with the most specific pattern;
// ties go to the group defined first.
function groupFor(name, level) {
  let best = null;
  for (const group of groups) {
    if (!group.updateTypes.includes(level)) continue;
    if (group.excludePatterns.some(p => globMatch(p, name))) continue;
    const scores = group.patterns.filter(p => globMatch(p, name)).map(p => patternSpecificity(p, name));
    if (!scores.length) continue;
    const score = Math.max(...scores);
    if (!best || score > best.score) best = { name: group.name, score };
  }
  return best?.name ?? '(no group: individual PR)';
}

const registry = (await run('npm', ['config', 'get', 'registry'])).stdout.trim().replace(/\/?$/, '/');

async function packument(name) {
  const response = await fetch(`${registry}${name.replace('/', '%2f')}`);
  if (!response.ok) throw new Error(`registry returned ${response.status} for ${name}`);
  return response.json();
}

async function plan(name, range) {
  const parsed = splitRange(range);
  if (!parsed) return { name, error: `unsupported catalog range "${range}"` };
  const rules = rulesFor(name);
  if (rules.ignored) return { name, skipped: 'ignored entirely by dependabot.yml' };

  const current = parsed.version;
  const installed = resolved[name]?.version;
  // Like dependabot, measure updates from what is installed, not from the catalog floor.
  const base = installed && compareVersions(installed, current) > 0 ? installed : current;

  const doc = await packument(name);
  const latestTag = doc['dist-tags']?.latest;
  const time = doc.time ?? {};
  // Stable, not deprecated, and not above the `latest` dist-tag (other tags can carry
  // stable-looking versions that aren't the release line).
  const candidates = Object.keys(doc.versions ?? {})
    .filter(
      v =>
        STABLE_VERSION.test(v) &&
        compareVersions(v, base) > 0 &&
        !doc.versions[v].deprecated &&
        (!latestTag || !STABLE_VERSION.test(latestTag) || compareVersions(v, latestTag) <= 0)
    )
    .sort(compareVersions);

  const notes = [];
  if (!installed) notes.push('not in the lockfile');
  if (parsed.prefix === '') notes.push('exact pin');
  const lagging = base !== current;

  if (!candidates.length) {
    return lagging ? { name, prefix: parsed.prefix, current, installed, floorOnly: true } : null;
  }

  const ageExempt = ageExcludes.some(pattern => globMatch(pattern, name));
  const isOldEnough = v => ageExempt || new Date(time[v]).getTime() < cutoff;
  const isExcluded = v => rules.excludedVersions.some(rule => satisfies(v, rule));
  const eligible = candidates.filter(
    v => rules.allowed.has(bumpLevel(base, v)) && !isExcluded(v) && isOldEnough(v)
  );
  const target = eligible.at(-1) ?? null;
  const latest = candidates.at(-1);

  // Explain why `latest` is not the target, most specific reason first.
  let heldBack = null;
  if (target !== latest) {
    const level = bumpLevel(base, latest);
    if (!rules.allowed.has(level)) heldBack = `${level} (dependabot ignores ${level} for this package)`;
    else if (isExcluded(latest)) heldBack = 'excluded by a dependabot `versions` ignore rule';
    else heldBack = `younger than minimumReleaseAge (published ${time[latest]?.slice(0, 10) ?? 'unknown'})`;
  }

  const level = target && bumpLevel(base, target);
  // Under semver a 0.x minor is breaking, but dependabot still classifies it as minor.
  if (level === 'minor' && base.startsWith('0.')) notes.push('0.x minor: breaking under semver, review');

  return {
    name,
    prefix: parsed.prefix,
    current,
    installed,
    target,
    level,
    group: target ? groupFor(name, level) : null,
    latest,
    heldBack,
    floorOnly: !target && lagging,
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

const results = (
  await mapLimit(catalog, CONCURRENCY, async ([name, range]) => {
    try {
      return await plan(name, range);
    } catch (error) {
      return { name, error: error.message };
    }
  })
).filter(Boolean);

const bumps = results.filter(r => r.target);
const floorOnly = results.filter(r => r.floorOnly);
const held = results.filter(r => r.heldBack);
const skipped = results.filter(r => r.skipped);
const errors = results.filter(r => r.error);

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
  console.log(
    `## ${group}\n\n| Package | Catalog | Installed | To | Level | Notes |\n| --- | --- | --- | --- | --- | --- |`
  );
  for (const r of items) {
    console.log(
      `| ${r.name} | ${cell(r)} | ${r.installed ?? '?'} | ${r.prefix}${r.target} | ${r.level} | ${r.notes.join('; ')} |`
    );
  }
  console.log(
    `\nApply: node .claude/skills/dependency-updates/scripts/bump-catalog.mjs ${items.map(r => `${r.name}@${r.target}`).join(' ')}\n`
  );
}
if (floorOnly.length) {
  console.log(
    '## Floor-only (lockfile already resolves a newer version; not an update, not in the apply commands)\n\n| Package | Catalog | Installed |\n| --- | --- | --- |'
  );
  for (const r of floorOnly) console.log(`| ${r.name} | ${cell(r)} | ${r.installed} |`);
  console.log('');
}
if (held.length) {
  console.log(
    '## Held back (newer version exists)\n\n| Package | Catalog | Latest | Planned | Why latest is not taken |\n| --- | --- | --- | --- | --- |'
  );
  for (const r of held) {
    console.log(`| ${r.name} | ${cell(r)} | ${r.latest} | ${r.target ?? 'none'} | ${r.heldBack} |`);
  }
  console.log('');
}
if (skipped.length) {
  console.log('## Skipped\n');
  for (const r of skipped) console.log(`- ${r.name}: ${r.skipped}`);
  console.log('');
}
if (errors.length) {
  console.log('## Errors (these packages were NOT planned)\n');
  for (const r of errors) console.log(`- ${r.name}: ${r.error}`);
  process.exitCode = 1;
}
