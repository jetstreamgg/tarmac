#!/usr/bin/env node
// Runs the local checks for the files changed on this branch, in parallel:
// prettier and eslint on the changed files, a TypeScript 7 typecheck of the webapp,
// vitest on the tests related to the changed webapp sources, and a webapp build.
//
// Usage: pnpm check:changed [--base <ref>] [--fix] [--full] [--skip <step,...>] [files...]
//   --base   compare against this ref (default: merge-base with origin/development)
//   --fix    write prettier formatting and eslint fixes instead of only checking
//   --full   run the full fast vitest suite instead of only the related tests
//   --skip   comma-separated steps to skip: prettier, eslint, typecheck, tests, build
//   files    check these files instead of the ones changed since the base
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const webapp = resolve(root, 'apps/webapp');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const fix = flag('fix');
const full = flag('full');
const skip = new Set((option('skip') ?? '').split(',').filter(Boolean));

const git = (...gitArgs) =>
  execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const resolveBase = () => {
  const explicit = option('base');
  if (explicit) return explicit;
  for (const ref of ['origin/development', 'development']) {
    try {
      return git('merge-base', 'HEAD', ref)[0];
    } catch {
      // Try the next candidate
    }
  }
  return 'HEAD';
};

// Positional arguments (anything that is not a flag or an option value) replace change detection
const valueOptions = new Set(['--base', '--skip']);
const explicit = args.filter((arg, i) => !arg.startsWith('--') && !valueOptions.has(args[i - 1]));

const base = explicit.length > 0 ? undefined : resolveBase();
const source = base ? `since ${base.slice(0, 9)}` : 'given';
// Committed, staged and unstaged changes since the base, plus untracked files. Deleted files are dropped.
const changed = [
  ...new Set(
    explicit.length > 0
      ? explicit.map(file => relative(root, resolve(process.env.INIT_CWD ?? process.cwd(), file)))
      : [
          ...git('diff', '--name-only', '--diff-filter=d', base),
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
// Tests under src/hooks need a Tenderly vnet, so the fast suite excludes them and so does this script
const hooksTests = changed.filter(file => /^apps\/webapp\/src\/hooks\/.*\.test\.tsx?$/.test(file));

const tsc7 = resolve(root, 'node_modules/typescript-7/bin/tsc');

const steps = [
  {
    name: 'prettier',
    run: changed.length > 0,
    cmd: 'pnpm',
    args: ['exec', 'prettier', fix ? '--write' : '--check', '--cache', '--ignore-unknown', ...changed]
  },
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
      ...lintable
    ]
  },
  {
    name: 'typecheck',
    run: typed.length > 0,
    cmd: tsc7,
    args: ['--noEmit', '--pretty', 'false', '-p', 'apps/webapp/tsconfig.json']
  },
  {
    name: 'tests',
    run: full || webappSources.length > 0,
    cmd: 'pnpm',
    args: full
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
    run: webappSources.length > 0 || changed.some(file => file.startsWith('apps/webapp/')),
    cmd: 'pnpm',
    args: ['exec', 'vite', 'build', '--config', 'vite.config.ts', '--logLevel', 'warn'],
    cwd: webapp
  }
].filter(step => step.run && !skip.has(step.name));

const runStep = step =>
  new Promise(done => {
    const started = performance.now();
    const child = spawn(step.cmd, step.args, {
      cwd: step.cwd ?? root,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
    });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('error', error => (output += String(error)));
    child.on('close', code => {
      const seconds = (performance.now() - started) / 1000;
      const testFiles = output.match(/Test Files\s+(.+)/)?.[1].trim();
      const detail = step.name === 'tests' ? `, ${testFiles ?? 'no test files'}` : '';
      console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${step.name} (${seconds.toFixed(1)}s${detail})`);
      done({ ...step, code, seconds, output });
    });
  });

console.log(`Checking ${changed.length} file(s) (${source}): ${steps.map(s => s.name).join(', ')}`);
const started = performance.now();
const results = await Promise.all(steps.map(runStep));
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

process.exit(results.every(r => r.code === 0) ? 0 : 1);
