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

function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(',').map(parseScalar) : [];
  }
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1);
  return value;
}

const KEY_RE = /^('([^']*)'|"([^"]*)"|[^'"][^:]*?):(?:\s+(.*))?$/;

/**
 * Parses the YAML subset used by pnpm-workspace.yaml and dependabot.yml:
 * block mappings, block sequences (of scalars or mappings), quoted keys and
 * values, flow sequences of scalars, and comments. Scalars stay strings.
 */
export function parseYaml(text) {
  const lines = [];
  for (const raw of text.split('\n')) {
    const content = stripComment(raw).trimEnd();
    if (!content.trim()) continue;
    lines.push({ indent: content.length - content.trimStart().length, text: content.trim() });
  }
  let i = 0;

  function parseBlock(indent) {
    return lines[i].text.startsWith('- ') || lines[i].text === '-' ? parseSeq(indent) : parseMap(indent);
  }

  function parseChild(parentIndent) {
    const next = lines[i];
    if (!next) return null;
    // `key:` followed by a sequence at the same indent is valid YAML.
    if (next.indent > parentIndent || (next.indent === parentIndent && next.text.startsWith('- '))) {
      return parseBlock(next.indent);
    }
    return null;
  }

  function parseMap(indent) {
    const map = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const match = KEY_RE.exec(lines[i].text);
      if (!match) throw new Error(`Unsupported YAML line: ${lines[i].text}`);
      const key = match[2] ?? match[3] ?? match[1].trim();
      i++;
      map[key] = match[4] === undefined || match[4] === '' ? parseChild(indent) : parseScalar(match[4]);
    }
    return map;
  }

  function parseSeq(indent) {
    const seq = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) {
      const item = lines[i].text.slice(2).trim();
      if (KEY_RE.test(item) && !/^(['"]).*\1$/.test(item)) {
        // `- key: value` opens a mapping whose keys sit two columns in.
        lines[i] = { indent: indent + 2, text: item };
        seq.push(parseMap(indent + 2));
      } else {
        i++;
        seq.push(parseScalar(item));
      }
    }
    return seq;
  }

  return lines.length ? parseBlock(lines[0].indent) : {};
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

/** Splits a catalog range like `^1.2.3`, `~1.2.3` or `1.2.3` into prefix and version. */
export function splitRange(range) {
  const match = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(String(range));
  return match ? { prefix: match[1], version: match[2] } : null;
}

/**
 * Whether `version` satisfies a dependabot `versions` entry, e.g. `>=20.12.0`,
 * `>= 2.0, < 3`, `20.x` or `1.2.3`. Unsupported syntax throws so a rule is never
 * silently ignored.
 */
export function satisfies(version, requirement) {
  return requirement
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .every(part => {
      const wildcard = /^(\d+)(?:\.(\d+))?\.[x*]$/.exec(part);
      if (wildcard) {
        const [major, minor] = [wildcard[1], wildcard[2]];
        const [v0, v1] = parseVersion(version);
        return v0 === Number(major) && (minor === undefined || v1 === Number(minor));
      }
      const comparator = /^(>=|<=|>|<|=)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part);
      if (!comparator) throw new Error(`Unsupported dependabot version requirement: ${part}`);
      const bound = [comparator[2], comparator[3] ?? 0, comparator[4] ?? 0].join('.');
      const cmp = compareVersions(version, bound);
      return { '>=': cmp >= 0, '<=': cmp <= 0, '>': cmp > 0, '<': cmp < 0, '=': cmp === 0 }[
        comparator[1] ?? '='
      ];
    });
}

/** Matches dependabot's `*` glob patterns. */
export function globMatch(pattern, name) {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${source}$`).test(name);
}
