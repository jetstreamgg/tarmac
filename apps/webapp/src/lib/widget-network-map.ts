import { mainnet } from 'viem/chains';
import { Intent } from './enums';
import { getChainName, isL2ChainId, isMainnetId, isTestnetId } from '@/utils';
import { normalizeUrlParam } from './helpers/string/normalizeUrlParam';
import { chainIdsForIntent, chainSwitchTarget, COMING_SOON_MAP } from './chainAvailability';

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

/** What landing on a module route should do given the chain the app points at. */
export type RouteChainAction =
  | { kind: 'render' }
  | { kind: 'switch-network'; chainId: number; network: string }
  | { kind: 'redirect-home' };

/**
 * Which chain a module route should run on, and whether getting there needs a
 * wallet switch. Three rules, in order:
 *
 *  a. **The network filter.** If the user has filtered the app to a network and
 *     this module runs there, that is where the module opens. The filter is a
 *     display filter everywhere else — this is the one place it decides a
 *     chain, and only on arrival (see `switchAttempted`).
 *  b. **The chain already in play.** Otherwise, if the module runs on the chain
 *     the app is pointed at, stay put — no prompt.
 *  c. **The module's home chain.** Otherwise switch to `chainSwitchTarget`: the
 *     dev fork when one is configured (so a dev wallet is never moved onto real
 *     Ethereum and real fees), else mainnet, else any chain the module runs on
 *     that the wallet config knows — the last of which is what would carry a
 *     future L2-only module.
 *
 * `currentChainId` is the chain the app is pointed at: the `network` search
 * param's chain when it has one, else the wallet's. The param normally mirrors
 * the wallet and leads it while a switch is in flight, which is what stops a
 * navigation validating against the chain being left.
 *
 * `switchAttempted` marks that this module visit already had its switch chance
 * — a declined wallet prompt, or an explicit wallet chain change. It keeps rule
 * (a) from fighting a user who switched chain by hand on the page, and makes
 * rule (c) fall through to the home redirect rather than re-prompting.
 *
 * Rule (a) is deliberately skipped for `BALANCES_INTENT` — the Portfolio and
 * the Earn marketplace, the two surfaces the filter is FOR. Applying it there
 * would let touching a display filter prompt the wallet, which is precisely
 * what this filter is not.
 *
 * A module that is coming-soon on the current chain still redirects home rather
 * than switching: "arriving here shortly" is a promise about *this* chain, so
 * moving the user off it would be the wrong answer.
 */
export function getRouteChainAction(
  intent: Intent,
  currentChainId: number,
  {
    switchAttempted = false,
    filterChainId = null,
    chains
  }: {
    switchAttempted?: boolean;
    /** The app-wide network filter (lib/networkFilter), or null for "All networks". */
    filterChainId?: number | null;
    chains?: readonly ChainRef[];
  } = {}
): RouteChainAction {
  const supported = chainIdsForIntent(intent);
  // Omitting `chains` means "assume production": every supported chain is a
  // candidate except the dev fork, and names come from the static map. The app
  // always passes them; the default keeps this callable as a pure predicate.
  const configuredIds = chains?.map(chain => chain.id) ?? supported.filter(id => !isTestnetId(id));
  const comingSoonHere = (COMING_SOON_MAP[currentChainId] ?? []).includes(intent);

  const switchTo = (id: number): RouteChainAction => ({
    kind: 'switch-network',
    chainId: id,
    network: normalizeUrlParam(chains?.find(chain => chain.id === id)?.name ?? getChainName(id))
  });

  // (a) The filter, when this module runs on it.
  if (
    !switchAttempted &&
    !comingSoonHere &&
    intent !== Intent.BALANCES_INTENT &&
    filterChainId !== null &&
    filterChainId !== currentChainId &&
    supported.includes(filterChainId) &&
    configuredIds.includes(filterChainId)
  ) {
    return switchTo(filterChainId);
  }

  // (b) The chain already in play hosts the module.
  if (supported.includes(currentChainId)) return { kind: 'render' };

  // (c) The module's home chain.
  if (!comingSoonHere && !switchAttempted) {
    const target = chainSwitchTarget(supported, configuredIds);
    if (target !== undefined && target !== currentChainId) return switchTo(target);
  }

  return { kind: 'redirect-home' };
}
