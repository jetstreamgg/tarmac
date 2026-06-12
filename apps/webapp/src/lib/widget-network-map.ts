import { Intent } from './enums';
import { isL2ChainId, isTestnetId } from '@/utils';
import { normalizeUrlParam } from './helpers/string/normalizeUrlParam';

/**
 * Defines network requirements for each widget/intent
 * 'mainnet' - Only available on Ethereum mainnet
 * 'multichain' - Available on multiple chains
 */
const WIDGET_NETWORK_REQUIREMENTS: Record<Intent, 'mainnet' | 'multichain'> = {
  [Intent.BALANCES_INTENT]: 'multichain',
  [Intent.REWARDS_INTENT]: 'mainnet', // Currently mainnet only
  [Intent.SAVINGS_INTENT]: 'multichain',
  [Intent.UPGRADE_INTENT]: 'mainnet',
  [Intent.TRADE_INTENT]: 'multichain',
  [Intent.STAKE_INTENT]: 'mainnet',
  [Intent.EXPERT_INTENT]: 'mainnet',
  [Intent.VAULTS_INTENT]: 'mainnet',
  [Intent.CONVERT_INTENT]: 'multichain',
  [Intent.FIXED_INTENT]: 'mainnet'
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

/**
 * Network search-param override for navigating to a module: mainnet-only
 * modules force `network=ethereum` when the current chain is an L2 (they're
 * not available there). Testnets are exempt so navigation never disrupts a
 * testing session. Returns undefined when no switch is needed.
 */
export function getNetworkOverrideForIntent(
  targetIntent: Intent,
  currentChainId?: number
): string | undefined {
  if (!currentChainId || isTestnetId(currentChainId)) return undefined;
  if (requiresMainnet(targetIntent) && isL2ChainId(currentChainId)) return normalizeUrlParam('Ethereum');
  return undefined;
}
