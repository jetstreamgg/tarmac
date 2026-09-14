import { ALLOWED_EXTERNAL_DOMAINS } from './constants';
import { reportError } from '@/modules/sentry/reportError';

export { cn } from './cn';

export type FooterLink = {
  url: string;
  name: string;
  /**
   * Retired. It only ever marked the promoted Careers button, which APP-456 #4
   * removed — entries still carrying it are dropped, so the link disappears
   * without waiting on a deploy-config edit. Kept on the type because the env
   * var is deployment-owned and may still list it.
   */
  highlight?: string;
};

let footerLinksParseErrorReported = false;

/**
 * The legal/informational links, parsed from the deployment's
 * `VITE_FOOTER_LINKS`. Promoted (`highlight`) entries are filtered out — see
 * {@link FooterLink}.
 */
export function getFooterLinks(): FooterLink[] {
  let footerLinks: FooterLink[] = [
    { url: '', name: '' },
    { url: '', name: '' },
    { url: '', name: '' }
  ];
  try {
    const footerLinksVar = import.meta.env.VITE_FOOTER_LINKS;
    if (footerLinksVar) footerLinks = JSON.parse(footerLinksVar);
  } catch (error) {
    if (!footerLinksParseErrorReported) {
      footerLinksParseErrorReported = true;
      reportError(error, {
        module: 'config',
        flow: 'footer-links',
        action: 'parse',
        type: 'env_parse_error'
      });
    }
  }
  return footerLinks.filter(link => link.highlight !== 'true');
}

/**
 * Sanitizes a URL to ensure it begins with 'https:'.
 * Some URLs are directly provided via environment variables.
 */
export function sanitizeUrl(url: string | undefined) {
  if (!url) return undefined;
  try {
    const parsedUrl = new URL(url);
    // Ensure that the url begins with 'https:'
    if (parsedUrl.protocol !== 'https:') {
      return undefined;
    }

    // Check if the domain is in the allowed list. Check for subdomains too
    if (
      !ALLOWED_EXTERNAL_DOMAINS.some(
        domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
      )
    ) {
      console.info(`"${parsedUrl.hostname}" not found in allow list, returning undefined`);
      return undefined;
    }

    // Remove any potential dangerous characters from the URL
    const sanitizedUrl = parsedUrl.toString().replace(/[^\w:/.?#&=-]/g, '');

    // Encode components to prevent XSS
    const encodedUrl = encodeURI(sanitizedUrl);

    // Validate the final URL
    new URL(encodedUrl); // This will throw if the URL is invalid

    return encodedUrl;
  } catch (error) {
    reportError(error, {
      module: 'ui',
      flow: 'sanitize-url',
      action: 'parse',
      type: 'url_parse_error'
    });
    return undefined;
  }
}
