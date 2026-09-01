import { ALLOWED_EXTERNAL_DOMAINS, QueryParams } from './constants';
import { Intent } from './enums';
import { INTENT_PATHS } from './navigation';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { getMainnetChainName } from '@/data/wagmi/config/config.default';
import { getMainnetTargetName } from './widget-network-map';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { reportError } from '@/modules/sentry/reportError';
import { Chain } from 'viem';

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

const getQueryParams = (url: string, searchParams: URLSearchParams) => {
  const { Locale } = QueryParams;
  const retainedParams = [Locale];

  return getRetainedQueryParams(url, retainedParams, searchParams);
};

export const getRewardsUrl = (searchParams: URLSearchParams, chainId: number, chains?: readonly Chain[]) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.REWARDS_INTENT]}?network=${normalizeUrlParam(getMainnetTargetName(chainId, chains))}`,
    searchParams
  );

export const getSavingsUrl = (
  searchParams: URLSearchParams,
  chainId: number,
  chains: readonly [Chain, ...Chain[]]
) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.SAVINGS_INTENT]}?network=${normalizeUrlParam(
      chains.find(c => c.id === chainId)?.name ?? getMainnetChainName(chainId)
    )}`,
    searchParams
  );

export const getStakeUrl = (searchParams: URLSearchParams, chainId: number, chains?: readonly Chain[]) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.STAKE_INTENT]}?network=${normalizeUrlParam(getMainnetTargetName(chainId, chains))}`,
    searchParams
  );
export const getStUsdsUrl = (searchParams: URLSearchParams, chainId: number, chains?: readonly Chain[]) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.EXPERT_INTENT]}?network=${normalizeUrlParam(getMainnetTargetName(chainId, chains))}`,
    searchParams
  );
export const getVaultsOverviewUrl = (
  searchParams: URLSearchParams,
  chainId: number,
  chains?: readonly Chain[]
) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.VAULTS_INTENT]}?network=${normalizeUrlParam(getMainnetTargetName(chainId, chains))}`,
    searchParams
  );
export const getFixedYieldUrl = (searchParams: URLSearchParams, chainId: number, chains?: readonly Chain[]) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.FIXED_INTENT]}?network=${normalizeUrlParam(getMainnetTargetName(chainId, chains))}`,
    searchParams
  );
export const getConvertUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `${INTENT_PATHS[Intent.CONVERT_INTENT]}?network=${getMainnetChainName(chainId)}`,
    searchParams
  );
