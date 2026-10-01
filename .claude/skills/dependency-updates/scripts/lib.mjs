// Shared helpers for the dependency-updates scripts. Dependency-free on purpose:
// no YAML or semver package is resolvable from the repo root.
import { readFileSync } from 'node:fs';

export const WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const DEPENDABOT_FILE = '.github/dependabot.yml';

// Cuts a trailing `# comment`, ignoring `#` inside quotes.
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

// Splits a flow sequence body on commas outside quotes.
function splitFlow(inner) {
  const items = [];
  let quote = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      items.push(inner.slice(start, i));
      start = i + 1;
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
      if (KEY_RE.test(item) && !/^(['"]).*\1$/.test(item)) {
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

/** One `  name: range` line of the catalog block, with the key unquoted. */
export const CATALOG_LINE_RE = /^ {2}(?:'([^']+)'|"([^"]+)"|([^\s:'"][^:]*?)): (.*)$/;

/** Splits a catalog range like `^1.2.3`, `~1.2.3` or `1.2.3` into prefix and version. */
export function splitRange(range) {
  const match = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(String(range));
  return match ? { prefix: match[1], version: match[2] } : null;
}

// --- npm range matching for dependabot `versions` ignore rules ---------------------------
// GitHub documents `versions` as the package manager's own range syntax, so for npm:
// `^1.0.0`, `~1.2`, `>=1 <2`, `1.x`, `1.2` (an x-range), `a - b` and `a || b`. Commas are
// also accepted as AND, matching dependabot's own parser.

const PARTIAL_RE = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/;

function parsePartial(text, rule) {
  const match = PARTIAL_RE.exec(text);
  if (!match) throw new Error(`Unsupported version "${text}" in dependabot versions rule "${rule}"`);
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
  return tokens.flatMap(token => expandComparator(token, rule));
}

/**
 * Whether `version` (a stable x.y.z) satisfies a dependabot `versions` entry for npm.
 * Unsupported syntax throws; callers decide whether that aborts one package or the run.
 */
export function satisfies(version, rule) {
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
  if (pattern === name) return 1000;
  if (pattern === '*') return 1;
  const wildcards = (pattern.match(/\*/g) ?? []).length;
  if (wildcards === 0) return 500;
  return Math.max(100 - wildcards * 10 + Math.max(pattern.length - 5, 0), 1);
}
