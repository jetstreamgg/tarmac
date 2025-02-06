import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LinkedAction } from '@/modules/ui/hooks/useUserSuggestedActions';
import { ALLOWED_EXTERNAL_DOMAINS } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFooterLinks(): { url: string; name: string }[] {
  let footerLinks: { url: string; name: string }[] = [
    { url: '', name: '' },
    { url: '', name: '' },
    { url: '', name: '' }
  ];
  try {
    const footerLinksVar = import.meta.env.VITE_FOOTER_LINKS;
    if (footerLinksVar) footerLinks = JSON.parse(footerLinksVar);
  } catch (error) {
    console.error('Error parsing FOOTER_LINKS:', error);
  }
  return footerLinks;
}

export function filterActionsByIntent(actions: LinkedAction[], intent: string) {
  return actions.filter(x => x.intent === intent || (x as LinkedAction)?.la === intent);
}

/**
 * Sanitizes a URL to ensure it begins with 'https:'.
 * Some URLs are directly provided via environment variables.
 */
type SanitizeUrlOptions = {
  searchParamsOnly: boolean;
};

const URL_SAFE_CHARS_REGEX = /[^\w:/.?#&=-]/g;
const URL_PARAM_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;

function parseUrl(url: string, isSearchParamsOnly: boolean) {
  return isSearchParamsOnly ? `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}` : url;
}

export function sanitizeUrl(
  url: string | undefined,
  options: SanitizeUrlOptions = { searchParamsOnly: false }
) {
  if (!url) return undefined;
  try {
    // If searchParamsOnly is true, prepend the current origin
    const fullUrl = parseUrl(url, options.searchParamsOnly);

    const parsedUrl = new URL(fullUrl);

    // Get the sanitized search params
    const searchParams = new URLSearchParams(parsedUrl.search);
    const sanitizedParams = new URLSearchParams();

    // Sanitize each search param value
    searchParams.forEach((value, key) => {
      // Only allow alphanumeric, hyphen, underscore for keys
      if (URL_PARAM_KEY_REGEX.test(key)) {
        const sanitizedValue = value.replace(URL_SAFE_CHARS_REGEX, '');
        sanitizedParams.append(key, sanitizedValue);
      }
    });

    const isValidExternalUrl =
      parsedUrl.protocol === 'https:' &&
      ALLOWED_EXTERNAL_DOMAINS.some(
        domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
      );

    const sanitizedUrl = options.searchParamsOnly
      ? `${parsedUrl.pathname}${sanitizedParams.toString() ? `?${sanitizedParams.toString()}` : ''}`
      : isValidExternalUrl
        ? parsedUrl.toString().replace(URL_SAFE_CHARS_REGEX, '')
        : undefined;

    if (!sanitizedUrl) return undefined;

    // Encode components to prevent XSS
    const encodedUrl = parseUrl(encodeURI(sanitizedUrl), options.searchParamsOnly);

    // Validate the final URL
    new URL(encodedUrl); // This will throw if the URL is invalid

    return options.searchParamsOnly
      ? sanitizedParams.toString()
        ? `/?${sanitizedParams.toString()}`
        : undefined
      : encodedUrl;
  } catch (error) {
    console.error('Error parsing url: ', error);
    return undefined;
  }
}
