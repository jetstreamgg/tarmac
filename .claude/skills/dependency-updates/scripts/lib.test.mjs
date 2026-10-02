// Tests for lib.mjs. Run with: node --test .claude/skills/dependency-updates/scripts/lib.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  bumpCatalogText,
  filterOverrides,
  bumpLevel,
  globMatch,
  lockfileChildVersions,
  lockfilePackages,
  parseOverrideSelector,
  parseYaml,
  patternSpecificity,
  satisfies,
  splitRange,
  topLevelBlock,
  workspaceManifests
} from './lib.mjs';

describe('parseYaml', () => {
  test('parses the real config files', () => {
    const repoRoot = new URL('../../../../', import.meta.url);
    const dependabot = parseYaml(readFileSync(new URL('.github/dependabot.yml', repoRoot), 'utf8'));
    const npm = dependabot.updates.find(u => u['package-ecosystem'] === 'npm');
    assert.ok(Object.keys(npm.groups).includes('web3-tools'));
    assert.ok(npm.ignore.length > 0);
    const workspace = parseYaml(readFileSync(new URL('pnpm-workspace.yaml', repoRoot), 'utf8'));
    assert.ok(Object.keys(workspace.catalog).length > 0);
    assert.ok(workspace.minimumReleaseAge);
  });

  test('mappings, sequences of mappings, quoted keys and comments', () => {
    const text = [
      "'@scope/pkg': ~1.2.3 # pinned",
      'list:',
      '  - dependency-name: "x"',
      '    update-types: ["a", "b"]',
      '  -   dependency-name: y',
      '      versions: [">= 1, < 2"]',
      'url: https://example.com/a#b'
    ].join('\n');
    assert.deepEqual(parseYaml(text), {
      '@scope/pkg': '~1.2.3',
      list: [
        { 'dependency-name': 'x', 'update-types': ['a', 'b'] },
        { 'dependency-name': 'y', versions: ['>= 1, < 2'] }
      ],
      url: 'https://example.com/a#b'
    });
  });

  test('a sequence at the same indent as its key', () => {
    assert.deepEqual(parseYaml('packages:\n- apps/*\n- libs/*'), { packages: ['apps/*', 'libs/*'] });
  });

  test('BOM, CRLF and a trailing flow comma', () => {
    assert.deepEqual(parseYaml('\uFEFFa: 1\r\nv: [">=20.14.0",]\r\n'), { a: '1', v: ['>=20.14.0'] });
  });

  test('a sequence item whose key and value are both quoted is a mapping', () => {
    assert.deepEqual(
      parseYaml("ignore:\n  - 'dependency-name': 'happy-dom'\n    \"versions\": ['>=20.12.0']"),
      {
        ignore: [{ 'dependency-name': 'happy-dom', versions: ['>=20.12.0'] }]
      }
    );
  });

  test('an apostrophe inside plain text is not a quote', () => {
    assert.deepEqual(parseYaml('a: Sky\'s thing # c\nb: [it\'s, "x, y"]'), {
      a: "Sky's thing",
      b: ["it's", 'x, y']
    });
  });

  for (const [label, text] of [
    ['multi-line flow sequence', 'a:\n  b: [\n    "x",\n  ]'],
    ['empty flow item', 'v: [a,,b]'],
    ['unterminated quote in flow sequence', 'v: ["a, b]'],
    ['bare dash', 'a:\n  -\n  - b'],
    ['block scalar', 'a: |\n  text'],
    ['anchor', 'a: &x 1'],
    ['flow mapping', 'a: {b: 1}'],
    ['leftover lines', 'a: 1\n  b: 2'],
    ['duplicate key', 'a: 1\na: 2'],
    ['multiple documents', 'a: 1\n---\nb: 2']
  ]) {
    test(`throws on ${label}`, () => assert.throws(() => parseYaml(text)));
  }
});

describe('satisfies', () => {
  const cases = [
    ['20.12.0', '>=20.12.0', true],
    ['20.11.15', '>=20.12.0', false],
    ['20.14.5', '20.14', true],
    ['20.15.0', '20.14', false],
    ['20.14.5', '>= 20.12, < 21', true],
    ['21.0.0', '>= 20.12, < 21', false],
    ['1.9.9', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['0.2.9', '^0.2', true],
    ['0.3.0', '^0.2.1', false],
    ['0.0.4', '^0.0.3', false],
    ['0.9.0', '^0', true],
    ['1.2.9', '~1.2', true],
    ['1.3.0', '~1.2.3', false],
    ['1.5.0', '~1', true],
    ['1.5.0', '>=1 <2', true],
    ['2.0.0', '>=1 <2', false],
    ['3.1.0', '1.x || 3.x', true],
    ['2.1.0', '1.x || 3.x', false],
    ['1.5.0', '1.2.3 - 2.3', true],
    ['2.3.9', '1.2.3 - 2.3', true],
    ['2.4.0', '1.2.3 - 2.3', false],
    ['1.3.0', '>1.2', true],
    ['1.2.9', '>1.2', false],
    ['1.2.9', '<=1.2', true],
    ['1.3.0', '<=1.2', false],
    ['5.0.0', '*', true],
    ['20.3.1', '20.x', true],
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '=1.2.3', false],
    ['8.17.1', '>=7.0.0-alpha.0 <8.18.0', true],
    ['8.18.0', '>=7.0.0-alpha.0 <8.18.0', false],
    ['1.0.0-rc.1', '<1.0.1', true]
  ];
  for (const [version, range, expected] of cases) {
    test(`${version} ${expected ? 'satisfies' : 'does not satisfy'} "${range}"`, () => {
      assert.equal(satisfies(version, range), expected);
    });
  }

  test('throws on unsupported syntax', () => {
    assert.throws(() => satisfies('1.0.0', 'latest'));
  });

  test('throws on an empty range or an empty || alternative', () => {
    assert.throws(() => satisfies('1.2.3', ''));
    assert.throws(() => satisfies('3.0.0', '<2 || '));
    assert.equal(satisfies('3.0.0', '*'), true);
  });
});

describe('versions and patterns', () => {
  test('bumpLevel', () => {
    assert.equal(bumpLevel('1.2.3', '2.0.0'), 'major');
    assert.equal(bumpLevel('1.2.3', '1.3.0'), 'minor');
    assert.equal(bumpLevel('1.2.3', '1.2.4'), 'patch');
  });

  test('splitRange', () => {
    assert.deepEqual(splitRange('^1.2.3'), { prefix: '^', version: '1.2.3' });
    assert.deepEqual(splitRange('1.2.3'), { prefix: '', version: '1.2.3' });
    assert.equal(splitRange('workspace:*'), null);
  });

  test('globMatch is anchored and case-insensitive', () => {
    assert.ok(globMatch('@wagmi/*', '@wagmi/core'));
    assert.ok(!globMatch('eslint*', '@tanstack/eslint-plugin-query'));
    assert.ok(globMatch('React', 'react'));
  });

  test('patternSpecificity mirrors dependabot-core scores', () => {
    assert.equal(patternSpecificity('wagmi', 'wagmi'), 1000);
    assert.equal(patternSpecificity('*', 'wagmi'), 1);
    assert.equal(patternSpecificity('eslint*', 'eslint'), 92);
    assert.equal(patternSpecificity('@tanstack/*', '@tanstack/react-query'), 96);
    assert.equal(patternSpecificity(undefined, 'anything'), 500);
  });
});

describe('bumpCatalogText', () => {
  const workspace = [
    'packages:',
    '  - apps/*',
    '',
    'catalog:',
    "  '@base-org/account': ~2.5.10",
    "  '@tanstack/react-router': 1.170.32",
    '  viem: ^2.55.19 # keep the comment',
    '',
    'overrides:',
    '  viem@<2.0.0: ^2.0.0',
    ''
  ].join('\n');

  test('keeps ~, ^, exact styles and trailing comments', () => {
    const { text, changes } = bumpCatalogText(workspace, [
      '@base-org/account@2.5.11',
      '@tanstack/react-router@1.170.39',
      'viem@2.56.8'
    ]);
    assert.match(text, /^ {2}'@base-org\/account': ~2\.5\.11$/m);
    assert.match(text, /^ {2}'@tanstack\/react-router': 1\.170\.39$/m);
    assert.match(text, /^ {2}viem: \^2\.56\.8 # keep the comment$/m);
    assert.match(text, /^ {2}viem@<2\.0\.0: \^2\.0\.0$/m, 'overrides stay untouched');
    assert.deepEqual(
      changes.map(c => `${c.name} ${c.from} -> ${c.to}`),
      [
        '@base-org/account ~2.5.10 -> ~2.5.11',
        '@tanstack/react-router 1.170.32 -> 1.170.39',
        'viem ^2.55.19 -> ^2.56.8'
      ]
    );
  });

  test('tolerates a header comment, trailing spaces and quoted ranges', () => {
    const text = ['catalog:  # versions', "  vite: '^8.2.2'   ", '  react: "19.2.8" # pinned  ', ''].join(
      '\n'
    );
    const { text: out } = bumpCatalogText(text, ['vite@8.3.1', 'react@19.3.0']);
    assert.equal(
      out,
      ['catalog:  # versions', "  vite: '^8.3.1'   ", '  react: "19.3.0" # pinned  ', ''].join('\n')
    );
  });

  test('preserves CRLF line endings', () => {
    const { text } = bumpCatalogText(workspace.replace(/\n/g, '\r\n'), ['viem@2.56.8']);
    assert.ok(text.includes('viem: ^2.56.8 # keep the comment\r\n'));
  });

  for (const [label, specs] of [
    ['an unknown package', ['nope@1.0.0']],
    ['a downgrade', ['viem@2.0.0']],
    ['a no-op', ['viem@2.55.19']],
    ['a malformed version', ['viem@2.56']],
    ['an override-only name', ['viem@<2.0.0@3.0.0']]
  ]) {
    test(`refuses ${label}`, () => assert.throws(() => bumpCatalogText(workspace, specs)));
  }
});

describe('overrides', () => {
  test('parseOverrideSelector tells ranges from parent selectors', () => {
    assert.deepEqual(parseOverrideSelector('axios@>=1.0.0 <1.20.0'), {
      parent: null,
      name: 'axios',
      range: '>=1.0.0 <1.20.0'
    });
    assert.deepEqual(parseOverrideSelector('@json-rpc-tools/provider>axios@^0.21.0'), {
      parent: '@json-rpc-tools/provider',
      name: 'axios',
      range: '^0.21.0'
    });
    assert.deepEqual(parseOverrideSelector('@babel/runtime@7.26.7'), {
      parent: null,
      name: '@babel/runtime',
      range: '7.26.7'
    });
    assert.deepEqual(parseOverrideSelector('foo'), { parent: null, name: 'foo', range: null });
    assert.deepEqual(parseOverrideSelector('foo>7zip-bin@<5'), {
      parent: 'foo',
      name: '7zip-bin',
      range: '<5'
    });
    assert.deepEqual(parseOverrideSelector('parent@1>JSONStream@<1.3.1'), {
      parent: 'parent',
      name: 'JSONStream',
      range: '<1.3.1'
    });
    assert.deepEqual(parseOverrideSelector('vite@>=8.0.0 <=8.0.15'), {
      parent: null,
      name: 'vite',
      range: '>=8.0.0 <=8.0.15'
    });
    assert.deepEqual(parseOverrideSelector('a@>1 || >2'), { parent: null, name: 'a', range: '>1 || >2' });
  });

  const lockfile = [
    "lockfileVersion: '9.0'",
    '',
    'packages:',
    '',
    "  '@json-rpc-tools/provider@1.7.6':",
    '    resolution: {integrity: sha512-x}',
    '',
    '  axios@0.21.4:',
    '    resolution: {integrity: sha512-y}',
    '',
    '  axios@1.20.0:',
    '    resolution: {integrity: sha512-z}',
    '',
    'snapshots:',
    '',
    "  '@json-rpc-tools/provider@1.7.6':",
    '    dependencies:',
    '      axios: 0.21.4(debug@4.4.0)',
    '      ws: 7.5.11',
    '',
    '  other@1.0.0:',
    '    dependencies:',
    '      axios: 1.20.0',
    ''
  ].join('\n');

  test('lockfilePackages lists resolved versions per package', () => {
    const packages = lockfilePackages(lockfile);
    assert.deepEqual([...packages.get('axios')].sort(), ['0.21.4', '1.20.0']);
    assert.deepEqual([...packages.get('@json-rpc-tools/provider')], ['1.7.6']);
  });

  test('lockfileChildVersions only reads the parent snapshot', () => {
    assert.deepEqual([...lockfileChildVersions(lockfile, '@json-rpc-tools/provider', 'axios')], ['0.21.4']);
    assert.deepEqual([...lockfileChildVersions(lockfile, 'other', 'axios')], ['1.20.0']);
  });
});

describe('workspace blocks', () => {
  const workspace = [
    'catalog:',
    '  vite: ^8.3.1',
    '',
    '# Watchlist: elliptic is deliberately not overridden.',
    'overrides:  # security floors',
    '  esbuild@<0.28.1: ~0.28.1',
    '# a column-0 comment inside the block',
    "  '@babel/runtime@7.26.7': 7.26.10",
    '  axios@>=1.0.0 <1.20.0: ^1.20.0',
    '',
    '# allowBuilds comment',
    'allowBuilds:',
    '  esbuild: false',
    ''
  ].join('\n');

  test('topLevelBlock spans inner column-0 comments but not the next key comment', () => {
    const lines = workspace.split('\n');
    const { start, end } = topLevelBlock(lines, 'overrides');
    assert.equal(lines[start], 'overrides:  # security floors');
    assert.equal(lines[end - 1], '  axios@>=1.0.0 <1.20.0: ^1.20.0');
    assert.equal(topLevelBlock(lines, 'missing'), null);
  });

  test('filterOverrides keeps only the selected entries', () => {
    const out = filterOverrides(workspace, key => key === '@babel/runtime@7.26.7');
    assert.ok(out.includes("  '@babel/runtime@7.26.7': 7.26.10"));
    assert.ok(!out.includes('esbuild@<0.28.1'));
    assert.ok(!out.includes('axios@>=1.0.0'));
    assert.ok(out.includes('overrides:  # security floors'));
    assert.ok(out.includes('allowBuilds:\n  esbuild: false'));
    assert.deepEqual(Object.keys(parseYaml(out).overrides), ['@babel/runtime@7.26.7']);
  });

  test('filterOverrides drops the header when nothing is kept, and keeps CRLF', () => {
    const out = filterOverrides(workspace.replace(/\n/g, '\r\n'), () => false);
    assert.ok(!out.includes('overrides:'));
    assert.ok(out.includes('allowBuilds:\r\n  esbuild: false'));
    assert.equal(parseYaml(out).overrides, undefined);
  });

  test('filterOverrides throws without an overrides block', () => {
    assert.throws(() => filterOverrides('catalog:\n  vite: ^8.3.1\n', () => true));
  });

  test('workspaceManifests expands dir/* globs and keeps only existing manifests', () => {
    const files = new Set(['package.json', 'apps/webapp/package.json']);
    const manifests = workspaceManifests(
      { packages: ['apps/*'] },
      { exists: file => files.has(file), listDirs: () => ['webapp', 'empty'] }
    );
    assert.deepEqual(manifests, ['package.json', 'apps/webapp/package.json']);
    assert.throws(() =>
      workspaceManifests({ packages: ['apps/**'] }, { exists: () => true, listDirs: () => [] })
    );
  });
});
