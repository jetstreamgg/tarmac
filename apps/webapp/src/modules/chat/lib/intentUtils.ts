import { arbitrum, base, Chain, mainnet, optimism, unichain } from 'wagmi/chains';
import { CHATBOT_USE_TESTNET_NETWORK_NAME, COMING_SOON_MAP, QueryParams } from '@/lib/constants';
import { ChatIntent } from '../types/Chat';
import { Intent } from '@/lib/enums';
import { isIntentAllowed } from '@/lib/utils';
import { tenderly } from '@/data/wagmi/config/config.default';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';

export const networkMapping = {
  [normalizeUrlParam(mainnet.name)]: 1,
  ethereum: 1,
  [normalizeUrlParam(base.name)]: 8453,
  arbitrum: 42161,
  [normalizeUrlParam(arbitrum.name)]: 42161,
  [normalizeUrlParam(unichain.name)]: 130,
  [normalizeUrlParam(optimism.name)]: 10,
  optimism: 10
} as const;

export const chainIdNameMapping = {
  [mainnet.id]: 'ethereum',
  [base.id]: 'base',
  [arbitrum.id]: 'arbitrumone',
  [tenderly.id]: 'ethereum',
  [unichain.id]: 'unichain',
  [optimism.id]: 'optimism'
} as const;

// Map of chainId to chain objects for display names
const chains = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
  [unichain.id]: unichain
};

export const getNetworkDisplayName = (network: string | undefined): string => {
  if (!network) return 'Ethereum';

  // Get chainId from network identifier
  const chainId =
    networkMapping[network as keyof typeof networkMapping] ||
    networkMapping[network.toLowerCase() as keyof typeof networkMapping];

  if (chainId && chains[chainId]) {
    return chains[chainId].name;
  }

  // Fallback: capitalize the network name
  return network.charAt(0).toUpperCase() + network.slice(1);
};

export const testnetNameMapping = {
  [normalizeUrlParam(mainnet.name)]: normalizeUrlParam(mainnet.name),
  [normalizeUrlParam(base.name)]: normalizeUrlParam(base.name),
  [normalizeUrlParam(arbitrum.name)]: normalizeUrlParam(arbitrum.name),
  [normalizeUrlParam(tenderly.name)]: normalizeUrlParam(mainnet.name),
  [normalizeUrlParam(unichain.name)]: normalizeUrlParam(unichain.name),
  [normalizeUrlParam(optimism.name)]: normalizeUrlParam(optimism.name),
  optimism: normalizeUrlParam(optimism.name)
} as const;

export const intents = {
  balances: Intent.BALANCES_INTENT,
  rewards: Intent.REWARDS_INTENT,
  savings: Intent.SAVINGS_INTENT,
  upgrade: Intent.UPGRADE_INTENT,
  trade: Intent.TRADE_INTENT,
  stake: Intent.STAKE_INTENT,
  expert: Intent.EXPERT_INTENT
} as const;

export type NetworkName = keyof typeof networkMapping;
export type ChainId = (typeof networkMapping)[NetworkName];

export type BaseIntentParams = {
  amount?: string | null;
  network?: Chain | null;
};

export const generateBaseUrl = (intentId: string, params: Record<string, string | undefined>): string => {
  const urlParams = new URLSearchParams();
  urlParams.append(QueryParams.Widget, encodeURIComponent(intentId));
  urlParams.append(QueryParams.Chat, 'true');

  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.append(key, encodeURIComponent(value));
  });

  return `?${urlParams.toString()}`;
};

export const addNetworkToDescription = (description: string, network?: Chain): string => {
  return network ? `${description} on ${network.name}` : description;
};

export const sortIntentsByPriority = (intents: ChatIntent[]): ChatIntent[] => {
  return [...intents].sort((a, b) => {
    const aHasAmount = a.url.includes(QueryParams.InputAmount);
    const bHasAmount = b.url.includes(QueryParams.InputAmount);
    const aHasNetwork = a.url.includes('network=');
    const bHasNetwork = b.url.includes('network=');

    // Prioritize network-specific intents
    if (aHasNetwork !== bHasNetwork) return aHasNetwork ? -1 : 1;
    if (aHasAmount !== bHasAmount) return aHasAmount ? -1 : 1;
    return 0;
  });
};

export const getChainFromNetwork = (
  detectedNetwork: string | undefined,
  chains: Chain[]
): Chain | undefined => {
  if (!detectedNetwork) return undefined;

  return chains.find(c => c.id === networkMapping[detectedNetwork.toLowerCase() as NetworkName]);
};

export const intentModifiesState = (intent?: ChatIntent): boolean => {
  if (!intent) return false;
  return (
    intent.intent_id !== 'balances' &&
    (intent.url.includes(QueryParams.InputAmount) ||
      intent.url.includes(QueryParams.SourceToken) ||
      intent.url.includes(QueryParams.TargetToken))
  );
};

/**
 * Checks if an intent contains pre-fill parameters that would automatically
 * populate form fields. Used to filter intents.
 *
 * @param intent - The chat intent to check
 * @returns true if the intent has pre-fill parameters, false otherwise
 */
export const hasPreFillParameters = (intent?: ChatIntent): boolean => {
  if (!intent?.url) return false;

  try {
    const urlObj = new URL(
      intent.url,
      typeof window !== 'undefined' ? window.location.origin : 'http://temp'
    );
    return (
      urlObj.searchParams.has(QueryParams.InputAmount) ||
      urlObj.searchParams.has(QueryParams.SourceToken) ||
      urlObj.searchParams.has(QueryParams.TargetToken)
    );
  } catch {
    // If URL parsing fails, assume it HAS pre-fill parameters
    return true;
  }
};

export const processNetworkNameInUrl = (url: string): string => {
  if (CHATBOT_USE_TESTNET_NETWORK_NAME) {
    const networkMappings = {
      [normalizeUrlParam(mainnet.name)]: tenderly.name,
      [normalizeUrlParam(unichain.name)]: normalizeUrlParam(unichain.name), // Uni and OP have no testnet
      [normalizeUrlParam(optimism.name)]: normalizeUrlParam(optimism.name)
    } as const;

    return Object.entries(networkMappings).reduce((processedUrl, [mainnet, testnet]) => {
      return processedUrl.replace(`network=${mainnet}`, `network=${testnet}`);
    }, url);
  }
  return url;
};

export const ensureIntentHasNetwork = (intentUrl: string, currentChainId: number): string => {
  const urlObj = new URL(intentUrl, window.location.origin);

  // If network is already present, return as-is
  if (urlObj.searchParams.has('network')) {
    return intentUrl;
  }

  // Get the widget to determine which network to use
  const intentWidget = urlObj.searchParams.get('widget');
  if (!intentWidget) {
    // No widget specified, can't determine network, return as-is
    return intentUrl;
  }

  // Look up the Intent enum for this widget
  const intentEnum = intents[intentWidget as keyof typeof intents];
  if (!intentEnum) {
    // Unknown widget, return as-is
    return intentUrl;
  }

  // Check if the widget is supported on the current chain
  const supportedOnCurrentChain = isIntentAllowed(intentEnum, currentChainId);

  // Use current chain if supported, otherwise default to Ethereum
  const targetChainId = supportedOnCurrentChain ? currentChainId : mainnet.id;
  const networkName =
    chainIdNameMapping[targetChainId as keyof typeof chainIdNameMapping] || normalizeUrlParam(mainnet.name);

  urlObj.searchParams.set('network', networkName);
  return urlObj.pathname + urlObj.search;
};

export const isChatIntentAllowed = (intent: ChatIntent): boolean => {
  try {
    const urlObj = new URL(intent.url, window.location.origin);
    const intentWidget = urlObj.searchParams.get(QueryParams.Widget);
    const intentNetwork = urlObj.searchParams.get(QueryParams.Network);

    if (!intentWidget) {
      console.warn('Intent URL missing widget param:', intent.url);
      return false; // Cannot determine allowance without widget
    }

    // Look up the Intent enum based on the widget string
    const intentEnum = intents[intentWidget as keyof typeof intents];

    if (intentEnum === undefined) {
      console.warn('Could not map widget to known value:', { intentWidget });
      return false; // Widget name is not recognized
    }

    // If intent has no network parameter, always allow it
    // The app will handle network switching internally (usually to Ethereum or current chain)
    if (!intentNetwork) {
      return true;
    }

    // If the network param is present and it's a valid network, check if allowed on that network
    const mappedChainId = networkMapping[intentNetwork as keyof typeof networkMapping];
    if (mappedChainId === undefined) {
      // Invalid network param value, intent is not allowed
      return false;
    }

    // Check if the intent is allowed on the specified network
    return (
      isIntentAllowed(intentEnum, mappedChainId) && !COMING_SOON_MAP[mappedChainId]?.includes(intentEnum)
    );
  } catch (error) {
    console.error('Failed to parse intent URL or check allowance:', error);
    return false;
  }
};
