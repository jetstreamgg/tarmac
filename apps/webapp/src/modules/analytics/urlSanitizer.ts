/**
 * APP-504: strip PII from URLs captured in PostHog events via a `before_send` hook.
 *
 * Allowlist strategy over URL *query param keys* (never over event properties):
 * any string property that parses as an http(s) URL is rebuilt masking the
 * values of non-allowlisted params (keys survive with value `redacted` for
 * traceability); everything else in the event is left untouched.
 *
 * This file is deliberately self-contained (zero imports) so the marketing
 * site (Webflow) can copy it verbatim and call `createSanitizeUrlsBeforeSend`
 * with its own extra params.
 */

// Campaign/click-ID params posthog-js reads for attribution — always kept.
const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'gclsrc',
  'gad_source',
  'gbraid',
  'wbraid',
  'dclid',
  'fbclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  'mc_cid',
  'igshid',
  'ttclid',
  'rdt_cid',
  'epik',
  'qclid',
  'sccid',
  'irclid',
  '_kx'
];

// Kept regardless of extra config: broader utm_* variants (utm_id, utm_source_platform…).
const DEFAULT_ALLOWED_PREFIXES = ['utm_'];

// Always masked, even if someone later allowlists them by mistake.
const DENYLISTED_PARAMS = ['name', 'email'];

// Param values matching an email shape are masked even under an allowlisted key.
const EMAIL_PATTERN = /[^\s@&?=/]+@[^\s@&?=/]+\.[A-Za-z]{2,}/;

// Masked params keep their key so unknown senders remain traceable.
const REDACTED_VALUE = 'redacted';

const MAX_DEPTH = 6;

export type UrlSanitizerOptions = {
  /** Extra allowed query param keys (exact match, case-insensitive). */
  allowedParams?: string[];
  /** Extra allowed key prefixes (case-insensitive). */
  allowedPrefixes?: string[];
};

type SanitizableEvent = {
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
} | null;

export function sanitizeUrlString(value: string, allowed: Set<string>, prefixes: string[]): string {
  if (!value.startsWith('http://') && !value.startsWith('https://')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (!url.search) return value;

  const kept = new URLSearchParams();
  for (const [key, val] of url.searchParams.entries()) {
    const k = key.toLowerCase();
    const disallowedKey =
      DENYLISTED_PARAMS.includes(k) || (!allowed.has(k) && !prefixes.some(p => k.startsWith(p)));
    // Keys always survive (masked) so we can trace who sends unknown params.
    kept.append(key, disallowedKey || EMAIL_PATTERN.test(val) ? REDACTED_VALUE : val);
  }
  url.search = kept.toString();
  return url.href;
}

function sanitizeInPlace(node: unknown, allowed: Set<string>, prefixes: string[], depth: number): void {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const value = node[i];
      if (typeof value === 'string') node[i] = sanitizeUrlString(value, allowed, prefixes);
      else sanitizeInPlace(value, allowed, prefixes, depth + 1);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === 'string') record[key] = sanitizeUrlString(value, allowed, prefixes);
    else sanitizeInPlace(value, allowed, prefixes, depth + 1);
  }
}

/**
 * Build a posthog-js `before_send` hook that sanitizes every URL-shaped string
 * in the event payload (properties, $set, $set_once — nested included, which
 * covers $current_url, $referrer, $session_entry_url, $initial_* and
 * autocapture attr__href).
 */
export function createSanitizeUrlsBeforeSend(options: UrlSanitizerOptions = {}) {
  const allowed = new Set([...CAMPAIGN_PARAMS, ...(options.allowedParams ?? [])].map(p => p.toLowerCase()));
  const prefixes = [...DEFAULT_ALLOWED_PREFIXES, ...(options.allowedPrefixes ?? [])].map(p =>
    p.toLowerCase()
  );

  return function sanitizeUrlsBeforeSend<T extends SanitizableEvent>(event: T): T {
    if (!event) return event;
    sanitizeInPlace(event.properties, allowed, prefixes, 0);
    sanitizeInPlace(event.$set, allowed, prefixes, 0);
    sanitizeInPlace(event.$set_once, allowed, prefixes, 0);
    return event;
  };
}
