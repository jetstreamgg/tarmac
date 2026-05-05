import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LinkedAction } from '@/modules/ui/hooks/useUserSuggestedActions';
import {
  ALLOWED_EXTERNAL_DOMAINS,
  CHAIN_WIDGET_MAP,
  ExpertIntentMapping,
  VaultsIntentMapping,
  IntentMapping,
  mapIntentToQueryParam,
  QueryParams
} from './constants';
import { ExpertIntent, Intent, VaultsIntent } from './enums';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { getMainnetChainName } from '@/data/wagmi/config/config.default';
import { reportError } from '@/modules/sentry/reportError';
import { Chain } from 'viem';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type FooterLink = { url: string; name: string; highlight?: string };

let footerLinksParseErrorReported = false;

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
      reportError(error, {
        module: 'config',
        flow: 'footer-links',
        action: 'parse',
        type: 'env_parse_error'
      });
      footerLinksParseErrorReported = true;
    }
  }
  return footerLinks;
}

const MODULE_PARENT_LINKED_ACTION_BY_INTENT: Record<string, string> = {
  ...Object.fromEntries(
    Object.values(ExpertIntentMapping).map(moduleIntent => [
      moduleIntent,
      IntentMapping[Intent.EXPERT_INTENT]
    ])
  ),
  ...Object.fromEntries(
    Object.values(VaultsIntentMapping).map(moduleIntent => [
      moduleIntent,
      IntentMapping[Intent.VAULTS_INTENT]
    ])
  )
};

export function filterActionsByIntent(actions: LinkedAction[], intent: string): LinkedAction[] {
  const parentLinkedAction = MODULE_PARENT_LINKED_ACTION_BY_INTENT[intent];

  return actions.filter(x => {
    // Direct match on intent or linked action
    if (x.intent === intent || (x as LinkedAction)?.la === intent) {
      return true;
    }
    if (parentLinkedAction && (x as LinkedAction)?.la === parentLinkedAction) {
      return true;
    }
    return false;
  });
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

export function isIntentAllowed(intent: Intent, chainId: number) {
  const supportedIntents = CHAIN_WIDGET_MAP[chainId] || [];
  return supportedIntents.includes(intent);
}

export const getQueryParams = (url: string, searchParams: URLSearchParams) => {
  const { Locale, Details } = QueryParams;
  const retainedParams = [Locale, Details];

  return getRetainedQueryParams(url, retainedParams, searchParams);
};

export const getRewardsUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.REWARDS_INTENT)}`,
    searchParams
  );

export const getSavingsUrl = (
  searchParams: URLSearchParams,
  chainId: number,
  chains: readonly [Chain, ...Chain[]]
) =>
  getQueryParams(
    `/?network=${chains.find(c => c.id === chainId)?.name}&widget=${mapIntentToQueryParam(Intent.SAVINGS_INTENT)}`,
    searchParams
  );

export const getSealUrl = (searchParams: URLSearchParams, chainId: number) =>
  `/seal-engine${getQueryParams(`/?network=${getMainnetChainName(chainId)}`, searchParams)}`;

export const getStakeUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.STAKE_INTENT)}`,
    searchParams
  );
export const getStUsdsUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.EXPERT_INTENT)}&expert_module=${ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]}`,
    searchParams
  );
export const getMorphoVaultUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.VAULTS_INTENT)}&vault_module=${VaultsIntentMapping[VaultsIntent.MORPHO_VAULT_INTENT]}`,
    searchParams
  );
export const getExpertOverviewUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.EXPERT_INTENT)}`,
    searchParams
  );
export const getVaultsOverviewUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.VAULTS_INTENT)}`,
    searchParams
  );
export const getConvertUrl = (searchParams: URLSearchParams, chainId: number) =>
  getQueryParams(
    `/?network=${getMainnetChainName(chainId)}&widget=${mapIntentToQueryParam(Intent.CONVERT_INTENT)}`,
    searchParams
  );
