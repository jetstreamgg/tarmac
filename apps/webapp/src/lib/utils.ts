import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LinkedAction } from '@/modules/ui/hooks/useUserSuggestedActions';
import { ALLOWED_EXTERNAL_DOMAINS, CHAIN_WIDGET_MAP, IntentMapping, restrictedIntents } from './constants';
import { Intent } from './enums';

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
  // For expert module intents (like 'stusds'), also include actions with la='expert'
  const isExpertModuleIntent = ['stusds'].includes(intent);

  return actions.filter(x => {
    // Direct match on intent or linked action
    if (x.intent === intent || (x as LinkedAction)?.la === intent) {
      return true;
    }
    // For advanced module pages (stusds), show actions that lead to advanced modules
    if (isExpertModuleIntent && (x as LinkedAction)?.la === IntentMapping[Intent.EXPERT_INTENT]) {
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
      console.log(`"${parsedUrl.hostname}" not found in allow list, returning undefined`);
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
    console.error('Error parsing url: ', error);
    return undefined;
  }
}

export function isIntentAllowed(intent: Intent, chainId: number) {
  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';
  const isRestricted = isRestrictedBuild || isRestrictedMiCa;

  // First check if restricted build
  if (isRestricted && restrictedIntents.includes(intent)) {
    return false;
  }
  // Then check if widget is supported on current chain
  const supportedIntents = CHAIN_WIDGET_MAP[chainId] || [];

  return supportedIntents.includes(intent);
}
