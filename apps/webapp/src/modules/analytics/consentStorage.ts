const CONSENT_COOKIE_NAME = 'sky_consent';
const LEGACY_STORAGE_KEY = 'cookie_consent';

export type ServiceConsent = { posthog?: boolean; google_analytics?: boolean };

/**
 * Determine the top-level domain for cross-subdomain cookies.
 * Returns '.sky.money' in production, '' on localhost.
 */
function getCookieDomain(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  const parts = hostname.split('.');
  return parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : '';
}

/**
 * Read the raw sky_consent cookie value.
 */
function readCookieRaw(): string | null {
  if (typeof document === 'undefined') return null;
  for (const c of document.cookie.split(';')) {
    const trimmed = c.trim();
    if (trimmed.startsWith(`${CONSENT_COOKIE_NAME}=`)) {
      return trimmed.slice(CONSENT_COOKIE_NAME.length + 1);
    }
  }
  return null;
}

/**
 * Write JSON consent data to the cross-subdomain cookie.
 * This is a consent-management cookie (strictly necessary) — exempt from consent requirements.
 */
function writeCookie(data: Record<string, boolean>): void {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  const domainAttr = domain ? `; domain=${domain}` : '';
  const value = encodeURIComponent(JSON.stringify(data));
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}${domainAttr}; path=/; max-age=31536000; SameSite=Lax`; // 1 year
}

/**
 * Read consent from the cross-subdomain sky_consent cookie.
 * Single source of truth for consent state across all *.sky.money subdomains.
 *
 * On first load, migrates legacy localStorage consent to the cookie.
 * Returns null when no consent has been recorded (pending state).
 */
export function getStoredConsent(): ServiceConsent | null {
  if (typeof document === 'undefined') return null;

  const raw = readCookieRaw();
  if (raw) {
    try {
      const data = JSON.parse(decodeURIComponent(raw));
      if (typeof data === 'object' && data !== null) {
        const result: ServiceConsent = {};
        if (typeof data.posthog === 'boolean') result.posthog = data.posthog;
        if (typeof data.google_analytics === 'boolean') result.google_analytics = data.google_analytics;
        if (Object.keys(result).length > 0) return result;
      }
    } catch {
      // Corrupted cookie — treat as no consent
    }
  }

  // Migrate legacy localStorage → cookie (one-time)
  if (typeof window !== 'undefined') {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (typeof parsed === 'object' && parsed !== null && typeof parsed.posthog === 'boolean') {
          const migrated: ServiceConsent = { posthog: parsed.posthog };
          if (typeof parsed.google_analytics === 'boolean') migrated.google_analytics = parsed.google_analytics;
          saveConsent(migrated);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated;
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  return null;
}

/**
 * Save consent to the cross-subdomain cookie.
 * Merges with existing cookie data so other apps' keys aren't lost.
 * Also cleans up legacy localStorage if present.
 */
export function saveConsent(consent: ServiceConsent): void {
  if (typeof document === 'undefined') return;

  // Read existing cookie to preserve keys from other apps (e.g. cookie3, google_analytics)
  let existing: Record<string, boolean> = {};
  const raw = readCookieRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed === 'object' && parsed !== null) {
        existing = parsed;
      }
    } catch {
      // Corrupted — overwrite
    }
  }

  writeCookie({ ...existing, ...consent });

  // Clean up legacy localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

/**
 * Clear all consent (delete the cookie).
 */
export function clearConsent(): void {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  const domainAttr = domain ? `; domain=${domain}` : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=; path=/; max-age=0${domainAttr}`;

  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
