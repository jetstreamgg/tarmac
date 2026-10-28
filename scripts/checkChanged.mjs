#!/usr/bin/env node
// Runs the local checks for the files changed on this branch, in parallel:
// prettier and eslint on the changed files, a TypeScript 7 typecheck of the webapp,
// vitest on the tests related to the changed webapp sources, and a webapp build.
// Changes outside the webapp sources (dependencies, root or webapp config) run the
// typecheck, the build and the full test suite.
//
// Usage: pnpm check:changed [--base <ref> | --uncommitted] [--fix] [--full] [--skip <step,...>] [files...]
//   --base         compare against the merge-base with this ref (default: the base branch of the
//                  branch's open PR, else origin/development)
//   --uncommitted  check only the staged, unstaged and untracked changes
//   --fix          write eslint fixes and prettier formatting first, then run the other steps
//   --full         run the full fast vitest suite instead of only the related tests
//   --skip         comma-separated steps to skip: prettier, eslint, typecheck, tests, build
//   files          check these files instead of the changed ones
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const webapp = resolve(root, 'apps/webapp');

const STEPS = ['prettier', 'eslint', 'typecheck', 'tests', 'build'];
const usage = message => {
  console.error(
    `${message}\nUsage: pnpm check:changed [--base <ref> | --uncommitted] [--fix] [--full] [--skip <step,...>] [files...]`
  );
  process.exit(2);
};

// Accepts both `--name value` and `--name=value` for options
const flags = new Set();
const options = {};
const explicit = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) {
    explicit.push(arg);
    continue;
  }
  const [name, inline] = arg.slice(2).split(/=(.*)/s);
  if (name === 'fix' || name === 'full' || name === 'uncommitted') {
    if (inline !== undefined) usage(`--${name} takes no value`);
    flags.add(name);
  } else if (name === 'base' || name === 'skip') {
    const value = inline ?? argv[++i];
    if (!value || value.startsWith('--')) usage(`--${name} needs a value`);
    options[name] = value;
  } else {
    usage(`Unknown option --${name}`);
  }
}
const fix = flags.has('fix');
const full = flags.has('full');
const uncommitted = flags.has('uncommitted');
if (uncommitted && options.base) usage('--uncommitted and --base are mutually exclusive');
if ((uncommitted || options.base) && explicit.length > 0)
  usage('Files cannot be combined with --base or --uncommitted');
const skip = new Set((options.skip ?? '').split(',').filter(Boolean));
for (const step of skip) if (!STEPS.includes(step)) usage(`Unknown step "${step}" in --skip`);

const git = (...gitArgs) =>
  execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

// The base branch of this branch's open PR, so a PR stacked on another branch only checks its own
// changes. Undefined without gh, a PR or network access.
const prBaseBranch = () => {
  try {
    return execFileSync('gh', ['pr', 'view', '--json', 'baseRefName', '-q', '.baseRefName'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
  } catch {
    return undefined;
  }
};

const resolveBase = () => {
  if (uncommitted) return { rev: 'HEAD', label: 'uncommitted' };
  const prBase = options.base ? undefined : prBaseBranch();
  const candidates = options.base
    ? [options.base]
    : [...(prBase ? [`origin/${prBase}`, prBase] : []), 'origin/development', 'development'];
  for (const ref of candidates) {
    try {
      return { rev: git('merge-base', 'HEAD', ref)[0], label: `since ${ref}` };
    } catch {
      // Try the next candidate
    }
  }
  if (options.base) usage(`No merge-base between HEAD and "${options.base}"`);
  return { rev: 'HEAD', label: 'uncommitted' };
};

const base = explicit.length > 0 ? undefined : resolveBase();
const source = base?.label ?? 'given';
// Changes since the base (committed, staged and unstaged), plus untracked files. Deleted files are dropped.
const changed = [
  ...new Set(
    explicit.length > 0
      ? explicit.map(file => relative(root, resolve(process.env.INIT_CWD ?? process.cwd(), file)))
      : [
          ...git('diff', '--name-only', '--diff-filter=d', base.rev, '--'),
          ...git('ls-files', '--others', '--exclude-standard')
        ]
  )
].filter(file => existsSync(resolve(root, file)));

if (changed.length === 0) {
  console.log(`No changed files (${source}).`);
  process.exit(0);
}

const lintable = changed.filter(file => /\.(c|m)?[jt]sx?$/.test(file));
const typed = changed.filter(file => /\.(tsx?|json)$/.test(file));
const webappSources = changed.filter(
  file => file.startsWith('apps/webapp/src/') && !file.startsWith('apps/webapp/src/test/e2e/')
);
const buildSources = webappSources.filter(file => !/\.(test\.tsx?|md)$/.test(file));
// Dependencies and root or webapp config can affect any file, so they get the whole-project steps
const projectWide = changed.some(
  file =>
    !file.startsWith('apps/webapp/src/') &&
    !file.endsWith('.md') &&
    !/^(\.github|\.claude|scripts|apps\/webapp\/scripts)\//.test(file)
);
const fullTests = full || projectWide;
// Tests under src/hooks need a Tenderly vnet, so the fast suite excludes them and so does this script
const hooksTests = changed.filter(file => /^apps\/webapp\/src\/hooks\/.*\.test\.tsx?$/.test(file));

const tsc7 = resolve(root, 'node_modules/typescript-7/bin/tsc');

const steps = [
  {
    name: 'eslint',
    run: lintable.length > 0,
    cmd: 'pnpm',
    args: [
      'exec',
      'eslint',
      '--cache',
      // A separate cache, so linting a subset doesn't prune `pnpm lint`'s entries for every other file
      '--cache-location',
      'node_modules/.cache/eslint-check-changed',
      '--max-warnings',
      '0',
      '--no-warn-ignored',
      ...(fix ? ['--fix'] : []),
      '--',
      ...lintable
    ]
  },
  {
    name: 'prettier',
    run: true,
    cmd: 'pnpm',
    args: ['exec', 'prettier', fix ? '--write' : '--check', '--cache', '--ignore-unknown', '--', ...changed]
  },
  {
    name: 'typecheck',
    run: typed.length > 0 || projectWide,
    cmd: tsc7,
    args: ['--noEmit', '--pretty', 'false', '-p', 'apps/webapp/tsconfig.json']
  },
  {
    name: 'tests',
    run: fullTests || webappSources.length > 0,
    cmd: 'pnpm',
    args: fullTests
      ? ['exec', 'vitest', 'run']
      : [
          'exec',
          'vitest',
          'related',
          '--run',
          '--passWithNoTests',
          // Absolute paths: vitest's root is apps/webapp/src, so relative paths silently match nothing
          ...webappSources.map(file => resolve(root, file))
        ],
    cwd: webapp
  },
  {
    name: 'build',
    run: buildSources.length > 0 || projectWide,
    cmd: 'pnpm',
    // Built into a cache dir so a `dist` served by `pnpm preview` or the e2e suite is left alone
    args: [
      'exec',
      'vite',
      'build',
      '--config',
      'vite.config.ts',
      '--logLevel',
      'warn',
      '--outDir',
      resolve(root, 'node_modules/.cache/check-changed-build'),
      '--emptyOutDir'
    ],
    cwd: webapp,
    // An empty token overrides .env, so a check build never uploads sourcemaps to Sentry
    env: { SENTRY_AUTH_TOKEN: '' }
  }
].filter(step => step.run && !skip.has(step.name));

const runStep = step =>
  new Promise(done => {
    const started = performance.now();
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd ?? root,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...step.env }
    });
    // Decoded once at the end, so a multi-byte character split across chunks stays intact
    const chunks = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => chunks.push(chunk));
    let spawnError = '';
    child.on('error', error => (spawnError = String(error)));
    child.on('close', code => {
      const seconds = (performance.now() - started) / 1000;
      const output = Buffer.concat(chunks).toString('utf8') + spawnError;
      const testFiles = output.match(/Test Files\s+(.+)/)?.[1].trim();
      const detail = step.name === 'tests' ? `, ${testFiles ?? 'no test files'}` : '';
      console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${step.name} (${seconds.toFixed(1)}s${detail})`);
      done({ ...step, code, seconds, output });
    });
  });

console.log(`Checking ${changed.length} file(s) (${source}): ${steps.map(s => s.name).join(', ')}`);
const started = performance.now();
const results = [];
// With --fix, eslint and then prettier rewrite files, so they run alone and in order before
// anything reads those files. The full suite saturates every core, so running it beside the
// other steps slows it more than the overlap saves: it runs last.
const first = fix ? steps.filter(s => s.name === 'eslint' || s.name === 'prettier') : [];
const last = fullTests ? steps.filter(s => s.name === 'tests') : [];
for (const step of first) results.push(await runStep(step));
results.push(...(await Promise.all(steps.filter(s => !first.includes(s) && !last.includes(s)).map(runStep))));
for (const step of last) results.push(await runStep(step));
const total = (performance.now() - started) / 1000;

for (const result of results.filter(r => r.code !== 0)) {
  console.log(`\n--- ${result.name} output ---\n${result.output.trim()}`);
}

console.log(`\nTotal ${total.toFixed(1)}s`);
if (hooksTests.length > 0 || changed.some(file => file.startsWith('apps/webapp/src/hooks/'))) {
  console.log(
    'Note: vnet-backed hooks tests were not run. For the hooks you changed, run after `pnpm vnet:fork`:\n' +
      '  pnpm -F webapp exec vitest run -c vitest.hooks.config.ts <test files>'
  );
}

// exitCode rather than process.exit(), which can cut off output still being written to a pipe
process.exitCode = results.every(r => r.code === 0) ? 0 : 1;
