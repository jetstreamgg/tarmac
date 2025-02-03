import { Chain } from 'wagmi/chains';
import { ChatIntent, Slot } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { defaultConfig } from '@/modules/config/default-config';
import { Token } from '@jetstreamgg/hooks';

const networkMapping = {
  mainnet: 1,
  ethereum: 1,
  base: 8453,
  arbitrum: 42161
};

const chainIdNameMapping = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum'
};

type TokenPair = {
  sourceToken: string;
  targetToken: string;
};

type DisallowedPairs = Record<number, TokenPair[]>;

type IntentParams = {
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
  // ^^^^^^^

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
    // Use Base token list for now for Arbitrum. Remove this once we have a token list for Arbitrum
    const pairs = disallowedPairs[networkMapping.base];
    if (!pairs) return true;

    return pairs.some(
      p =>
        p.sourceToken.toLowerCase() === pair.sourceToken.toLowerCase() &&
        p.targetToken.toLowerCase() === pair.targetToken.toLowerCase()
    );
  }
  // ^^^^^^^

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
const generateIntentDescription = (params: IntentParams): string => {
  const { sourceToken, targetToken, amount, network } = params;
  const networkSuffix = network ? ` on ${network.name}` : '';
  if (sourceToken && targetToken) {
    if (amount) {
      return `Trade ${amount} ${sourceToken} for ${targetToken}${networkSuffix}`;
    }
    return `Trade ${sourceToken} for ${targetToken}${networkSuffix}`;
  }

  if (sourceToken) {
    if (amount) {
      return `Trade ${amount} ${sourceToken}${networkSuffix}`;
    }
    return `Trade ${sourceToken}${networkSuffix}`;
  }

  if (targetToken) {
    return `Trade to ${targetToken}${networkSuffix}`;
  }

  return `Go to Trade${networkSuffix}`;
};

/**
 * Generate URL with intent parameters
 */
const generateIntentUrl = (params: IntentParams): string => {
  const { Widget, InputAmount, SourceToken, TargetToken, Chat } = QueryParams;
  const { sourceToken, targetToken, amount, network } = params;

  const urlParams = new URLSearchParams();
  urlParams.append(Widget, IntentMapping.TRADE_INTENT);
  urlParams.append(Chat, 'true');

  if (sourceToken) urlParams.append(SourceToken, sourceToken);
  if (targetToken) urlParams.append(TargetToken, targetToken);
  if (amount) urlParams.append(InputAmount, amount);
  if (network) urlParams.append('network', chainIdNameMapping[network.id as keyof typeof chainIdNameMapping]);

  return `?${urlParams.toString()}`;
};

/**
 * Generate a single trade intent
 */
const generateSingleIntent = (params: IntentParams): ChatIntent => {
  return {
    intent_id: IntentMapping.TRADE_INTENT,
    intent_description: generateIntentDescription(params),
    url: generateIntentUrl(params)
  };
};

/**
 * Sort intents by relevance/priority
 * Priority order:
 * 1. Intents with amount and both tokens
 * 2. Intents with both tokens but no amount
 * 3. Intents with source token only
 * 4. Intents with target token only
 * 5. Generic trade intent
 */
const sortIntentsByPriority = (intents: ChatIntent[]): ChatIntent[] => {
  return [...intents].sort((a, b) => {
    const aHasAmount = a.url.includes(QueryParams.InputAmount);
    const bHasAmount = b.url.includes(QueryParams.InputAmount);
    const aHasSourceToken = a.url.includes(QueryParams.SourceToken);
    const bHasSourceToken = b.url.includes(QueryParams.SourceToken);
    const aHasTargetToken = a.url.includes(QueryParams.TargetToken);
    const bHasTargetToken = b.url.includes(QueryParams.TargetToken);
    const aHasNetwork = a.url.includes('network=');
    const bHasNetwork = b.url.includes('network=');

    // Prioritize network-specific intents
    if (aHasNetwork !== bHasNetwork) return aHasNetwork ? -1 : 1;
    if (aHasAmount !== bHasAmount) return aHasAmount ? -1 : 1;
    if ((aHasSourceToken && aHasTargetToken) !== (bHasSourceToken && bHasTargetToken)) {
      return aHasSourceToken && aHasTargetToken ? -1 : 1;
    }
    if (aHasSourceToken !== bHasSourceToken) return aHasSourceToken ? -1 : 1;
    if (aHasTargetToken !== bHasTargetToken) return aHasTargetToken ? -1 : 1;
    return 0;
  });
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

  const amountSlot = slots.find(slot => slot.field === 'amount');
  const sourceTokenSlot = slots.find(slot => slot.field === 'source_token');
  const targetTokenSlot = slots.find(slot => slot.field === 'target_token');

  const amount = amountSlot?.parsed_value;
  const sourceToken = sourceTokenSlot?.parsed_value;
  const targetToken = targetTokenSlot?.parsed_value;

  const allIntents: ChatIntent[] = [];

  // If we have a detected network, prioritize that network's intents
  if (detectedNetwork) {
    const targetChain = chains.find(
      c => c.id === networkMapping[detectedNetwork.toLowerCase() as keyof typeof networkMapping]
    );

    if (targetChain) {
      // Generate network-specific intent
      allIntents.push(generateSingleIntent({ sourceToken, targetToken, amount, network: targetChain }));
    }
  }

  // Always add network-agnostic intent as a fallback
  // allIntents.push(generateSingleIntent({ sourceToken, targetToken, amount }));

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
    validIntents.push({
      intent_id: IntentMapping.TRADE_INTENT,
      intent_description: 'Go to Trade',
      url: `?${QueryParams.Widget}=${IntentMapping.TRADE_INTENT}&${QueryParams.Chat}=true`
    });
  }

  // Sort intents by priority
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
