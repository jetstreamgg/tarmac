import { Chain } from 'viem';
import { ChatIntent, Slot, SlotType } from '../types/Chat';
import { IntentMapping, QueryParams } from '@/lib/constants';
import {
  chainIdNameMapping,
  generateBaseUrl,
  addNetworkToDescription,
  sortIntentsByPriority,
  getChainFromNetwork,
  generateFallbackIntent
} from './intentUtils';

// TODO: This should come from a config
const supportedTokensByNetwork: Record<number, string[]> = {
  1: ['USDS'],
  8453: ['USDS', 'USDC'],
  42161: ['USDS', 'USDC']
};

type SavingsIntentParams = {
  amount?: string | null;
  token?: string | null;
  network?: Chain | null;
  tab?: 'left' | 'right';
};

const isTokenSupportedOnNetwork = (token: string, chainId: number): boolean => {
  const networkTokens = supportedTokensByNetwork[chainId];
  if (!networkTokens) return false;
  return networkTokens.some(t => t.toLowerCase() === token.toLowerCase());
};

const generateSavingsDescription = (params: SavingsIntentParams): string => {
  const { amount, token, tab } = params;
  const action = tab === 'right' ? 'Withdraw' : 'Supply';
  let description = '';

  // Case 1: Complete info (amount + token + tab)
  if (amount && token && tab) {
    description = `${action} ${amount} ${token} ${tab === 'right' ? 'from' : 'to'} Savings`;
  }
  // Case 2: Amount + token (no tab)
  else if (amount && token) {
    description = `Supply or withdraw ${amount} ${token}`;
  }
  // Case 3: Amount + tab (no token)
  else if (amount && tab) {
    description = `${action} ${amount} ${tab === 'right' ? 'from' : 'to'} Savings`;
  }
  // Case 4: Token + tab (no amount)
  else if (token && tab) {
    description = `${action} ${token} ${tab === 'right' ? 'from' : 'to'} Savings`;
  }
  // Case 5: Only token
  else if (token) {
    description = `Supply or withdraw ${token}`;
  }
  // Case 6: Only tab
  else if (tab) {
    description = `${action} ${tab === 'right' ? 'from' : 'to'} Savings`;
  }
  // Case 7: No slots (generic)
  else {
    description = 'Go to Savings';
  }

  return addNetworkToDescription(description, params.network || undefined);
};

const generateSingleIntent = (params: SavingsIntentParams): ChatIntent => {
  const { amount, token, network, tab } = params;
  const urlParams: Record<string, string | undefined> = {
    [QueryParams.InputAmount]: amount ?? undefined,
    [QueryParams.SourceToken]: token ?? undefined,
    network: network ? chainIdNameMapping[network.id as keyof typeof chainIdNameMapping] : undefined,
    tab
  };

  return {
    intent_id: IntentMapping.SAVINGS_INTENT,
    intent_description: generateSavingsDescription(params),
    url: generateBaseUrl(IntentMapping.SAVINGS_INTENT, urlParams)
  };
};

export const generateSavingsIntents = (
  slots: Slot[],
  chains: Chain[],
  tab?: 'left' | 'right',
  detectedNetwork?: string
): ChatIntent[] => {
  if (import.meta.env.VITE_RESTRICTED_BUILD === 'true') {
    return [];
  }

  const { Amount, SourceToken } = SlotType;

  const amountSlot = slots.find(slot => slot.field === Amount);
  const tokenSlot = slots.find(slot => slot.field === SourceToken);

  const amount = amountSlot?.parsed_value;
  const token = tokenSlot?.parsed_value || 'USDS'; // Default to USDS if not specified

  const allIntents: ChatIntent[] = [];

  // If we have a detected network, prioritize that network's intents
  const targetChain = getChainFromNetwork(detectedNetwork, chains);
  if (targetChain && isTokenSupportedOnNetwork(token, targetChain.id)) {
    allIntents.push(generateSingleIntent({ amount, token, network: targetChain, tab }));
  }

  // If no network was detected, generate intents for all supported networks
  if (!detectedNetwork) {
    chains.forEach(chain => {
      if (isTokenSupportedOnNetwork(token, chain.id)) {
        allIntents.push(generateSingleIntent({ amount, token, network: chain, tab }));
      }
    });
  }

  // Always add a fallback intent if no valid intents were generated
  if (allIntents.length === 0) {
    allIntents.push(generateFallbackIntent(IntentMapping.SAVINGS_INTENT, 'Go to Savings'));
  }

  return sortIntentsByPriority(allIntents);
};
