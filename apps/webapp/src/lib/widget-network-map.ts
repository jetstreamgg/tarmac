import { Intent } from './enums';

/**
 * Defines network requirements for each widget/intent
 * 'mainnet' - Only available on Ethereum mainnet
 * 'multichain' - Available on multiple chains
 */
export const WIDGET_NETWORK_REQUIREMENTS: Record<Intent, 'mainnet' | 'multichain'> = {
  [Intent.BALANCES_INTENT]: 'multichain',
  [Intent.REWARDS_INTENT]: 'mainnet', // Currently mainnet only
  [Intent.SAVINGS_INTENT]: 'multichain',
  [Intent.UPGRADE_INTENT]: 'mainnet',
  [Intent.TRADE_INTENT]: 'multichain',
  [Intent.STAKE_INTENT]: 'mainnet',
  [Intent.EXPERT_INTENT]: 'multichain',
  [Intent.SEAL_INTENT]: 'mainnet'
};

/**
 * Check if an intent requires mainnet
 */
export function requiresMainnet(intent: Intent): boolean {
  return WIDGET_NETWORK_REQUIREMENTS[intent] === 'mainnet';
}

/**
 * Check if an intent supports multiple chains
 */
export function isMultichain(intent: Intent): boolean {
  return WIDGET_NETWORK_REQUIREMENTS[intent] === 'multichain';
}
