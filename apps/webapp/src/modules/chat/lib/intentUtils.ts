import { Chain } from 'wagmi/chains';
import { QueryParams } from '@/lib/constants';
import { ChatIntent } from '../types/Chat';

export const networkMapping = {
  mainnet: 1,
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  arbitrumone: 42161
} as const;

export const chainIdNameMapping = {
  1: 'ethereum',
  314310: 'ethereum', // tenderly
  8453: 'base',
  8555: 'base', // base tenderly
  42161: 'arbitrumone',
  421611: 'arbitrumone' // arbitrum+one tenderly
} as const;

export type NetworkName = keyof typeof networkMapping;
export type ChainId = (typeof networkMapping)[NetworkName];

export type BaseIntentParams = {
  amount?: string | null;
  network?: Chain | null;
};

export const generateBaseUrl = (intentId: string, params: Record<string, string | undefined>): string => {
  const urlParams = new URLSearchParams();
  urlParams.append(QueryParams.Widget, intentId);
  urlParams.append(QueryParams.Chat, 'true');

  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.append(key, value);
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

export const generateFallbackIntent = (intentId: string, description: string): ChatIntent => ({
  intent_id: intentId,
  intent_description: description,
  url: generateBaseUrl(intentId, {})
});
