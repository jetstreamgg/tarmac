import { Chain } from 'wagmi/chains';
import { ChatIntent, Slot, SlotType } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { defaultConfig } from '@/modules/config/default-config';
import { Token } from '@jetstreamgg/hooks';
import {
  networkMapping,
  chainIdNameMapping,
  generateBaseUrl,
  addNetworkToDescription,
  sortIntentsByPriority,
  getChainFromNetwork,
  generateFallbackIntent
} from './intentUtils';

type TokenPair = {
  sourceToken: string;
  targetToken: string;
};

type DisallowedPairs = Record<number, TokenPair[]>;

type TradeIntentParams = {
  sourceToken?: string | null;
  targetToken?: string | null;
  amount?: string | null;
  network?: Chain | null;
};

/**
 * Check if a token is supported on a specific network
 */
const isTokenSupportedOnNetwork = (
  token: string,
  chainId: number,
  tokenList: Record<number, Token[]>
): boolean => {
  // TODO: Remove this once we have a token list for Arbitrum vvvvvv
  if (chainId === networkMapping.arbitrum) {
    // Use Base token list for now for Arbitrum
    return tokenList[networkMapping.base].some(t => t.symbol.toLowerCase() === token.toLowerCase());
  }

  const networkTokens = tokenList[chainId];
  if (!networkTokens) return false;

  return networkTokens.some(t => t.symbol.toLowerCase() === token.toLowerCase());
};

/**
 * Check if a trade pair is allowed on a specific network
 */
const isPairAllowedOnNetwork = (
  pair: TokenPair,
  chainId: number,
  disallowedPairs: DisallowedPairs | undefined
): boolean => {
  if (!disallowedPairs) return true;

  // TODO: Remove this once we have a token list for Arbitrum vvvvvv
  if (chainId === networkMapping.arbitrum) {
    const pairs = disallowedPairs[networkMapping.base];
    if (!pairs) return true;

    return pairs.some(
      p =>
        p.sourceToken.toLowerCase() === pair.sourceToken.toLowerCase() &&
        p.targetToken.toLowerCase() === pair.targetToken.toLowerCase()
    );
  }

  const networkDisallowedPairs = disallowedPairs[chainId];
  if (!networkDisallowedPairs) return true;

  return !networkDisallowedPairs.some(
    p =>
      p.sourceToken.toLowerCase() === pair.sourceToken.toLowerCase() &&
      p.targetToken.toLowerCase() === pair.targetToken.toLowerCase()
  );
};

/**
 * Generate intent description with optional network name
 */
const generateTradeDescription = (params: TradeIntentParams): string => {
  const { sourceToken, targetToken, amount, network } = params;
  let description = '';

  if (sourceToken && targetToken) {
    description = amount
      ? `Trade ${amount} ${sourceToken} for ${targetToken}`
      : `Trade ${sourceToken} for ${targetToken}`;
  } else if (sourceToken) {
    description = amount ? `Trade ${amount} ${sourceToken}` : `Trade ${sourceToken}`;
  } else if (targetToken) {
    description = `Trade to ${targetToken}`;
  } else {
    description = 'Go to Trade';
  }

  return addNetworkToDescription(description, network || undefined);
};

/**
 * Generate a single trade intent
 */
const generateSingleIntent = (params: TradeIntentParams): ChatIntent => {
  const { sourceToken, targetToken, amount, network } = params;
  const urlParams: Record<string, string | undefined> = {
    [QueryParams.SourceToken]: sourceToken ?? undefined,
    [QueryParams.TargetToken]: targetToken ?? undefined,
    [QueryParams.InputAmount]: amount && sourceToken ? amount : undefined,
    network: network ? chainIdNameMapping[network.id as keyof typeof chainIdNameMapping] : undefined
  };

  return {
    intent_id: IntentMapping.TRADE_INTENT,
    intent_description: generateTradeDescription(params),
    url: generateBaseUrl(IntentMapping.TRADE_INTENT, urlParams)
  };
};

export const generateTradeIntents = (
  slots: Slot[],
  chains: Chain[],
  detectedNetwork?: string
): ChatIntent[] => {
  const disallowedPairs = defaultConfig.tradeDisallowedPairs;
  const tradeTokens = defaultConfig.tradeTokenList;

  if (import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true') {
    return [];
  }

  const { Amount, SourceToken, TargetToken } = SlotType;

  const amountSlot = slots.find(slot => slot.field === Amount);
  const sourceTokenSlot = slots.find(slot => slot.field === SourceToken);
  const targetTokenSlot = slots.find(slot => slot.field === TargetToken);

  const amount = amountSlot?.parsed_value;
  const sourceToken = sourceTokenSlot?.parsed_value;
  const targetToken = targetTokenSlot?.parsed_value;

  const allIntents: ChatIntent[] = [];

  // If we have a detected network, prioritize that network's intents
  const targetChain = getChainFromNetwork(detectedNetwork, chains);
  if (targetChain) {
    allIntents.push(generateSingleIntent({ sourceToken, targetToken, amount, network: targetChain }));
  }

  // If no network was detected, generate intents for all supported networks
  if (!detectedNetwork) {
    chains.forEach(chain => {
      allIntents.push(generateSingleIntent({ sourceToken, targetToken, amount, network: chain }));
    });
  }

  // Filter out invalid intents based on network support and restrictions
  const validIntents = allIntents.filter(intent => {
    const params = new URLSearchParams(intent.url.substring(1));
    const networkParam = params.get('network');
    const sourceParam = params.get(QueryParams.SourceToken);
    const targetParam = params.get(QueryParams.TargetToken);

    // Keep network-agnostic intents
    if (!networkParam) return true;

    const chain = chains.find(
      c => c.id === networkMapping[networkParam.toLowerCase() as keyof typeof networkMapping]
    );
    if (!chain) return false;

    const chainId = chain.id;

    // Don't allow same token for source and target
    if (
      sourceParam !== null &&
      targetParam !== null &&
      sourceParam.toLowerCase() === targetParam.toLowerCase()
    ) {
      return false;
    }

    // Check if tokens are supported on this network
    if (sourceParam !== null && !isTokenSupportedOnNetwork(sourceParam, chainId, tradeTokens)) {
      return false;
    }

    if (targetParam !== null && !isTokenSupportedOnNetwork(targetParam, chainId, tradeTokens)) {
      return false;
    }

    // Check if pair is allowed on this network
    if (sourceParam !== null && targetParam !== null) {
      const pair = { sourceToken: sourceParam, targetToken: targetParam };
      if (!isPairAllowedOnNetwork(pair, chainId, disallowedPairs)) {
        return false;
      }
    }

    return true;
  });

  // Always add generic trade intent as fallback if no valid intents
  if (validIntents.length === 0) {
    validIntents.push(generateFallbackIntent(IntentMapping.TRADE_INTENT, 'Go to Trade'));
  }

  return sortIntentsByPriority(validIntents);
};

// Checks:
//
// - Add a check to see if the trade pair is supported
// - Add a check to see if the trade pair is supported on the detected network
// - Filter out tokens that are not supported on the detected network
// - Add a check if the build is restricted
// - Generate the trade intents for all the supported networks/chains
// - Sort intents by relevance/priority
// - If we're in a restricted build like MiCa don't return Trade intents
// - don't allow the same token to be both source and target
