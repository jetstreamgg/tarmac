import { mainnet } from 'viem/chains';
import { Intent } from './enums';
import { isL2ChainId, isMainnetId, isTestnetId } from '@/utils';
import { normalizeUrlParam } from './helpers/string/normalizeUrlParam';
import { CHAIN_WIDGET_MAP, COMING_SOON_MAP } from './chainAvailability';

/** The subset of a wagmi chain the network-target helpers need. */
type ChainRef = { id: number; name: string };

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
 * The mainnet-family chain name navigation targets from an L2: the active
 * wagmi config's testnet mainnet when one exists (dev and mock builds work
 * against Tenderly forks; production configs carry no testnet chain), falling
 * back to Ethereum mainnet. A current chain that is already mainnet-family is
 * its own target. Deriving the name from the config keeps the value
 * resolvable by the network-param machinery in every environment — the mock
 * config names its fork "Tenderly Mainnet", not "Tenderly".
 */
export function getMainnetTargetName(currentChainId: number, chains?: readonly ChainRef[]): string {
  if (isMainnetId(currentChainId)) {
    return (
      chains?.find(c => c.id === currentChainId)?.name ??
      (isTestnetId(currentChainId) ? 'Tenderly' : 'Ethereum')
    );
  }
  const target = chains?.find(c => isTestnetId(c.id)) ?? chains?.find(c => c.id === mainnet.id);
  return target?.name ?? 'Ethereum';
}

/**
 * Network search-param override for navigating to a module: mainnet-only
 * modules force the mainnet-family network (see getMainnetTargetName) when
 * the current chain is an L2 (they're not available there). Testnets are
 * exempt so navigation never disrupts a testing session. Returns undefined
 * when no switch is needed.
 */
export function getNetworkOverrideForIntent(
  targetIntent: Intent,
  currentChainId?: number,
  chains?: readonly ChainRef[]
): string | undefined {
  if (!currentChainId || isTestnetId(currentChainId)) return undefined;
  if (requiresMainnet(targetIntent) && isL2ChainId(currentChainId)) {
    return normalizeUrlParam(getMainnetTargetName(currentChainId, chains));
  }
  return undefined;
}

/** What landing on a module route should do given the chain the URL points at. */
export type RouteChainAction =
  { kind: 'render' } | { kind: 'switch-network'; network: string } | { kind: 'redirect-home' };

/**
 * Decide between rendering a module, auto-switching the network, or sending
 * the user home. Mainnet-only modules reached with an L2 network don't bounce
 * home: in-app links retain the current network param and deep links can carry
 * anything, so the app switches on the user's behalf instead (announced by the
 * shell's network toast). `switchAttempted` marks that this module visit
 * already had its switch chance — a declined wallet prompt or an explicit
 * wallet chain change falls through to the home redirect rather than
 * re-prompting. Coming-soon modules and chains that can't host the module at
 * all still redirect home.
 */
export function getRouteChainAction(
  intent: Intent,
  targetChainId: number,
  { switchAttempted = false, chains }: { switchAttempted?: boolean; chains?: readonly ChainRef[] } = {}
): RouteChainAction {
  const allowed = CHAIN_WIDGET_MAP[targetChainId] ?? [];
  const comingSoon = COMING_SOON_MAP[targetChainId] ?? [];
  if (allowed.includes(intent) && !comingSoon.includes(intent)) return { kind: 'render' };
  if (!comingSoon.includes(intent) && !switchAttempted) {
    const network = getNetworkOverrideForIntent(intent, targetChainId, chains);
    if (network) return { kind: 'switch-network', network };
  }
  return { kind: 'redirect-home' };
}
