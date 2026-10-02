// Shared helpers for the dependency-updates scripts. Dependency-free on purpose:
// no YAML or semver package is resolvable from the repo root.
import { readFileSync } from 'node:fs';

export const WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const DEPENDABOT_FILE = '.github/dependabot.yml';

// A quote only opens a quoted scalar at the start of one: at the start of the line or of
// a flow item, or after `key:` or `- `. An apostrophe inside plain text (`Sky's`) is text.
const SCALAR_START = new Set(['', ':', '-', '[', ',']);

// Cuts a trailing `# comment`, ignoring `#` inside quotes.
function stripComment(line) {
  let quote = null;
  let last = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) [quote, last] = [null, ch];
    } else if ((ch === '"' || ch === "'") && SCALAR_START.has(last)) {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    } else if (!/\s/.test(ch)) {
      last = ch;
    }
  }
  return line;
}

// Splits a flow sequence body on commas outside quotes.
function splitFlow(inner) {
  const items = [];
  let quote = null;
  let last = '';
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === quote) [quote, last] = [null, ch];
    } else if ((ch === '"' || ch === "'") && (last === '' || last === ',')) {
      quote = ch;
    } else if (ch === ',') {
      items.push(inner.slice(start, i));
      [start, last] = [i + 1, ','];
    } else if (!/\s/.test(ch)) {
      last = ch;
    }
  }
  if (quote) throw new Error(`Unterminated quote in flow sequence: [${inner}]`);
  items.push(inner.slice(start));
  // A trailing comma is valid YAML and adds no item; any other empty item is an error.
  if (items.length > 1 && !items.at(-1).trim()) items.pop();
  if (items.some(item => !item.trim())) throw new Error(`Empty item in flow sequence: [${inner}]`);
  return items;
}

function parseScalar(raw, context) {
  const value = raw.trim();
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new Error(`Unsupported multi-line flow sequence: ${context}`);
    const inner = value.slice(1, -1);
    return inner.trim() ? splitFlow(inner).map(item => parseScalar(item, context)) : [];
  }
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1);
  // Anchors, aliases, tags, flow mappings and block scalars are outside the subset.
  if (/^[&*!{]/.test(value) || /^[|>][-+0-9]*$/.test(value)) {
    throw new Error(`Unsupported YAML value: ${context}`);
  }
  return value;
}

const KEY_RE = /^('([^']*)'|"([^"]*)"|[^'"\s][^:]*?):(?:\s+(.*))?$/;
const SEQ_ITEM_RE = /^-(\s+|$)/;

/**
 * Parses the YAML subset used by pnpm-workspace.yaml, pnpm-lock.yaml's `catalogs:`
 * block and dependabot.yml: block mappings, block sequences (of scalars or mappings),
 * quoted keys and values, single-line flow sequences of scalars, and comments.
 * Scalars stay strings. Anything outside the subset throws instead of being skipped,
 * so a config edit can never silently drop rules.
 */
export function parseYaml(text) {
  const lines = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (raw.includes('\t') && /^\s*\t/.test(raw)) throw new Error(`Tab indentation is not YAML: ${raw}`);
    const content = stripComment(raw).trimEnd();
    if (!content.trim()) continue;
    if (/^(---|\.\.\.)$/.test(content.trim())) throw new Error('Multi-document YAML is not supported');
    lines.push({ indent: content.length - content.trimStart().length, text: content.trim() });
  }
  let i = 0;

  const isSeqItem = line => SEQ_ITEM_RE.test(line.text);

  function parseBlock(indent) {
    return isSeqItem(lines[i]) ? parseSeq(indent) : parseMap(indent);
  }

  function parseChild(parentIndent) {
    const next = lines[i];
    if (!next) return null;
    // `key:` followed by a sequence at the same indent is valid YAML.
    if (next.indent > parentIndent || (next.indent === parentIndent && isSeqItem(next))) {
      return parseBlock(next.indent);
    }
    return null;
  }

  function parseMap(indent) {
    const map = {};
    while (i < lines.length && lines[i].indent === indent && !isSeqItem(lines[i])) {
      const line = lines[i];
      const match = KEY_RE.exec(line.text);
      if (!match) throw new Error(`Unsupported YAML line: ${line.text}`);
      const key = match[2] ?? match[3] ?? match[1].trim();
      if (Object.hasOwn(map, key)) throw new Error(`Duplicate YAML key: ${key}`);
      i++;
      map[key] =
        match[4] === undefined || match[4] === '' ? parseChild(indent) : parseScalar(match[4], line.text);
    }
    return map;
  }

  function parseSeq(indent) {
    const seq = [];
    while (i < lines.length && lines[i].indent === indent && isSeqItem(lines[i])) {
      const line = lines[i];
      const gap = SEQ_ITEM_RE.exec(line.text)[1].length;
      const item = line.text.slice(1 + gap);
      if (!item) throw new Error(`Unsupported empty sequence item at indent ${indent}`);
      // KEY_RE never matches a lone quoted scalar (`"a: b"`), only `key: value` pairs,
      // including ones whose key and value are both quoted.
      if (KEY_RE.test(item)) {
        // `- key: value` opens a mapping whose keys line up with the first key.
        lines[i] = { indent: indent + 1 + gap, text: item };
        seq.push(parseMap(indent + 1 + gap));
      } else {
        i++;
        seq.push(parseScalar(item, line.text));
      }
    }
    return seq;
  }

  if (!lines.length) return {};
  const result = parseBlock(lines[0].indent);
  if (i < lines.length) {
    throw new Error(`Unsupported YAML structure near: ${lines[i].text} (indent ${lines[i].indent})`);
  }
  return result;
}

export const readYaml = file => parseYaml(readFileSync(file, 'utf8'));

export const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export const parseVersion = version => version.split('.').map(Number);

export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** 'major' | 'minor' | 'patch' for a bump from `from` to `to`. */
export function bumpLevel(from, to) {
  const [x, y] = [parseVersion(from), parseVersion(to)];
  if (x[0] !== y[0]) return 'major';
  if (x[1] !== y[1]) return 'minor';
  return 'patch';
}

/**
 * One `  name: range  # comment` line of the catalog block. Groups: 1 everything up to the
 * value, 2-4 the key (single-quoted, double-quoted, plain), 5 the value (possibly quoted),
 * 6 a trailing comment, 7 trailing whitespace.
 */
export const CATALOG_LINE_RE = /^( {2}(?:'([^']+)'|"([^"]+)"|([^\s:'"#][^:]*?)):\s+)(\S+?)(\s+#.*?)?(\s*)$/;

/** Index range [start, end) of a top-level `name:` block, including column-0 comments in it. */
export function topLevelBlock(lines, name) {
  const header = new RegExp(`^${name}:\\s*(#.*)?$`);
  const start = lines.findIndex(line => header.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || /^[\s#]/.test(lines[end]))) end++;
  // Comments and blank lines right before the next key belong to that key, not to this block.
  while (end > start + 1 && (lines[end - 1].trim() === '' || lines[end - 1].startsWith('#'))) end--;
  return { start, end };
}

/**
 * Sets catalog versions in pnpm-workspace.yaml text, keeping each entry's `^`, `~` or exact
 * style, quotes, trailing comment and line endings. Only the top-level `catalog:` block is
 * touched. Throws, without returning partial text, on an unknown package, an unsupported
 * range, or a version that isn't newer than the current one.
 */
export function bumpCatalogText(text, specs) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const block = topLevelBlock(lines, 'catalog');
  if (!block) throw new Error('No top-level catalog: block');
  const { start, end } = block;

  const changes = [];
  for (const spec of specs) {
    const at = spec.lastIndexOf('@');
    const [name, version] = [spec.slice(0, at), spec.slice(at + 1)];
    if (at <= 0 || !STABLE_VERSION.test(version)) throw new Error(`Expected <pkg@x.y.z>, got "${spec}"`);

    let index = -1;
    let match = null;
    for (let i = start + 1; i < end; i++) {
      const m = CATALOG_LINE_RE.exec(lines[i]);
      if (m && (m[2] ?? m[3] ?? m[4]) === name) [index, match] = [i, m];
    }
    if (index === -1) throw new Error(`${name} is not in the catalog`);

    const [, lead, , , , value, comment = '', trailing] = match;
    const quote = /^(['"]).*\1$/.test(value) ? value[0] : '';
    const range = splitRange(quote ? value.slice(1, -1) : value);
    if (!range) throw new Error(`Unsupported catalog range for ${name}: ${value}`);
    if (compareVersions(version, range.version) <= 0) {
      throw new Error(`${name}@${version} is not newer than the catalog's ${range.prefix}${range.version}`);
    }
    lines[index] = `${lead}${quote}${range.prefix}${version}${quote}${comment}${trailing}`;
    changes.push({ name, from: `${range.prefix}${range.version}`, to: `${range.prefix}${version}` });
  }
  return { text: lines.join(eol), changes };
}

/** Splits a catalog range like `^1.2.3`, `~1.2.3` or `1.2.3` into prefix and version. */
export function splitRange(range) {
  const match = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(String(range));
  return match ? { prefix: match[1], version: match[2] } : null;
}

// --- npm range matching for dependabot `versions` ignore rules ---------------------------
// GitHub documents `versions` as the package manager's own range syntax, so for npm:
// `^1.0.0`, `~1.2`, `>=1 <2`, `1.x`, `1.2` (an x-range), `a - b` and `a || b`. Commas are
// also accepted as AND, matching dependabot's own parser.

// A prerelease or build suffix is accepted and dropped: these ranges only gate stable versions.
const PARTIAL_RE =
  /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parsePartial(text, rule) {
  const match = PARTIAL_RE.exec(text);
  if (!match) throw new Error(`Unsupported version "${text}" in range "${rule}"`);
  const parts = match.slice(1, 4).map(p => (p === undefined || /^[xX*]$/.test(p) ? null : Number(p)));
  // Anything after a wildcard is a wildcard too (`1.x.3` behaves like `1.x`).
  const firstWild = parts.indexOf(null);
  return firstWild === -1 ? parts : parts.map((p, index) => (index >= firstWild ? null : p));
}

const fmt = parts => parts.map(p => p ?? 0).join('.');

function bumpAt(parts, index) {
  const next = parts.map(p => p ?? 0);
  next[index] += 1;
  for (let k = index + 1; k < 3; k++) next[k] = 0;
  return next.join('.');
}

/** Expands one comparator token into [op, version] pairs that must all hold. */
function expandComparator(token, rule) {
  const match = /^(\^|~>?|>=|<=|>|<|=)?\s*(.*)$/.exec(token);
  const op = match[1] ?? '';
  const parts = parsePartial(match[2], rule);
  const defined = parts.filter(p => p !== null).length;
  if (defined === 0) return op === '<' || op === '>' ? [['<', '0.0.0']] : [];

  switch (op) {
    case '^': {
      // Bump the first non-zero component, or the last defined one if all are zero.
      let index = parts.findIndex((p, k) => k < defined && p !== 0);
      if (index === -1) index = defined - 1;
      return [
        ['>=', fmt(parts)],
        ['<', bumpAt(parts, index)]
      ];
    }
    case '~':
    case '~>':
      return [
        ['>=', fmt(parts)],
        ['<', bumpAt(parts, defined === 1 ? 0 : 1)]
      ];
    case '>':
      return defined === 3 ? [['>', fmt(parts)]] : [['>=', bumpAt(parts, defined - 1)]];
    case '>=':
      return [['>=', fmt(parts)]];
    case '<':
      return [['<', fmt(parts)]];
    case '<=':
      return defined === 3 ? [['<=', fmt(parts)]] : [['<', bumpAt(parts, defined - 1)]];
    default:
      // Bare or `=`: exact for a full version, an x-range for a partial one.
      return defined === 3
        ? [['=', fmt(parts)]]
        : [
            ['>=', fmt(parts)],
            ['<', bumpAt(parts, defined - 1)]
          ];
  }
}

function comparatorsFor(alternative, rule) {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(alternative);
  if (hyphen) {
    const upper = parsePartial(hyphen[2], rule);
    const defined = upper.filter(p => p !== null).length;
    return [
      ['>=', fmt(parsePartial(hyphen[1], rule))],
      defined === 3 ? ['<=', fmt(upper)] : ['<', bumpAt(upper, defined - 1)]
    ];
  }
  // Glue operators to their versions (`>= 1.2` -> `>=1.2`), then split on spaces and commas.
  const tokens = alternative
    .replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, '$1')
    .split(/[\s,]+/)
    .filter(Boolean);
  // An empty range would match everything; `*` is the explicit way to say that.
  if (!tokens.length) throw new Error(`Empty range or \`||\` alternative in "${rule}"`);
  return tokens.flatMap(token => expandComparator(token, rule));
}

/**
 * Whether `version` satisfies an npm range: a dependabot `versions` entry or a pnpm
 * override selector. A prerelease `version` is compared by its x.y.z. Unsupported syntax
 * throws; callers decide whether that aborts one item or the run.
 */
export function satisfies(version, rule) {
  version = String(version).replace(/[-+].*$/, '');
  const alternatives = String(rule)
    .split('||')
    .map(alt => alt.trim());
  return alternatives.some(alternative =>
    comparatorsFor(alternative, rule).every(([op, bound]) => {
      const cmp = compareVersions(version, bound);
      return { '>=': cmp >= 0, '<=': cmp <= 0, '>': cmp > 0, '<': cmp < 0, '=': cmp === 0 }[op];
    })
  );
}

/** Matches dependabot's `*` glob patterns (case-insensitive, like dependabot's WildcardMatcher). */
export function globMatch(pattern, name) {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${source}$`, 'i').test(name);
}

/**
 * Dependabot's score for how specifically a group pattern matches a name; the group with
 * the highest score wins and ties go to the earlier group. Mirrors dependabot-core's
 * updater/lib/dependabot/updater/pattern_specificity_calculator.rb.
 */
export function patternSpecificity(pattern, name) {
  if (pattern === undefined) return 500; // a group without `patterns` (NO_PATTERNS_SCORE)
  if (pattern === name) return 1000;
  if (pattern === '*') return 1;
  const wildcards = (pattern.match(/\*/g) ?? []).length;
  if (wildcards === 0) return 500;
  return Math.max(100 - wildcards * 10 + Math.max(pattern.length - 5, 0), 1);
}

/**
 * Splits a pnpm override key into its parts: `pkg`, `pkg@range`, `@scope/pkg@range` or
 * `parent>pkg@range` (the parent may carry a range too, which is ignored here).
 */
export function parseOverrideSelector(key) {
  // pnpm's own rule (@pnpm/parse-overrides): the separator is a `>` right after a character
  // other than space, `|` or `@`, so range operators like `@>=1` or ` >2` never split.
  const separator = /[^ |@]>/.exec(key);
  const [parentPart, childPart] = separator
    ? [key.slice(0, separator.index + 1), key.slice(separator.index + 2)]
    : [null, key];
  const split = part => {
    const at = part.indexOf('@', part.startsWith('@') ? 1 : 0);
    return at === -1 ? { name: part, range: null } : { name: part.slice(0, at), range: part.slice(at + 1) };
  };
  const child = split(childPart);
  return { parent: parentPart ? split(parentPart).name : null, name: child.name, range: child.range };
}

/** Every resolved `name -> Set(version)` in a v9 pnpm-lock.yaml's `packages:` section. */
export function lockfilePackages(lockText) {
  const section = /^packages:\r?\n([\s\S]*?)(?=^\S|(?![\s\S]))/m.exec(lockText)?.[1] ?? '';
  const versions = new Map();
  for (const match of section.matchAll(/^ {2}'?(@?[^@'\s]+)@([^('\s:]+)/gm)) {
    if (!versions.has(match[1])) versions.set(match[1], new Set());
    versions.get(match[1]).add(match[2]);
  }
  return versions;
}

/** Versions of `child` that any resolved `parent` depends on, from the `snapshots:` section. */
export function lockfileChildVersions(lockText, parent, child) {
  const section = /^snapshots:\r?\n([\s\S]*?)(?=^\S|(?![\s\S]))/m.exec(lockText)?.[1] ?? '';
  const found = new Set();
  const quotedChild = new RegExp(`^ {6}'?${child.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'?: (\\S+)`);
  let inParent = false;
  for (const line of section.split(/\r?\n/)) {
    if (/^ {2}\S/.test(line)) {
      const name = /^ {2}'?(@?[^@'\s]+)@/.exec(line)?.[1];
      inParent = name === parent;
    } else if (inParent) {
      const match = quotedChild.exec(line);
      if (match) found.add(match[1].replace(/\(.*$/, ''));
    }
  }
  return found;
}

/**
 * Keeps only the `overrides:` entries whose (unquoted) key passes `keep`, preserving every
 * other line. Drops the `overrides:` header too when no entry is left. Throws on an entry
 * line it can't read, so a layout change can't silently keep or drop the wrong override.
 */
export function filterOverrides(text, keep) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const block = topLevelBlock(lines, 'overrides');
  if (!block) throw new Error('No top-level overrides: block');
  const kept = [];
  let entries = 0;
  for (const line of lines.slice(block.start + 1, block.end)) {
    if (!line.trim() || line.trimStart().startsWith('#')) {
      kept.push(line);
      continue;
    }
    const match = /^\s+(?:'([^']*)'|"([^"]*)"|([^\s'"#][^#]*?)):(?:\s|$)/.exec(line);
    if (!match) throw new Error(`Unsupported overrides line: ${line}`);
    if (keep(match[1] ?? match[2] ?? match[3])) {
      kept.push(line);
      entries++;
    }
  }
  const header = entries ? [lines[block.start]] : [];
  return [...lines.slice(0, block.start), ...header, ...kept, ...lines.slice(block.end)].join(eol);
}

/** package.json paths of the workspace root and its packages (`dir/*` or plain `dir` globs). */
export function workspaceManifests(workspace, { exists, listDirs }) {
  const dirs = (workspace.packages ?? []).flatMap(glob => {
    if (glob.endsWith('/*')) return listDirs(glob.slice(0, -2)).map(dir => `${glob.slice(0, -2)}/${dir}`);
    if (/[*?{[!]/.test(glob)) throw new Error(`Unsupported workspace glob: ${glob}`);
    return [glob];
  });
  return ['package.json', ...dirs.map(dir => `${dir}/package.json`)].filter(exists);
}
