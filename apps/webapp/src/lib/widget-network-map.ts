import { Intent } from './enums';
import { isTestnetId } from '@/utils';
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

/** What landing on a module route should do given the chain the app points at. */
export type RouteChainAction =
  { kind: 'render' } | { kind: 'switch-network'; chainId: number } | { kind: 'redirect-home' };

/**
 * Which chain a module route should run on, and whether getting there needs a
 * wallet switch. Two rules, in order:
 *
 *  a. **The chain already in play.** If the module runs on the chain the app is
 *     pointed at, stay put — no prompt.
 *  b. **The module's home chain.** Otherwise switch to `chainSwitchTarget`: the
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
 * — a declined wallet prompt, or an explicit wallet chain change. It makes rule
 * (b) fall through to the home redirect rather than re-prompting.
 *
 * Neither applies to `BALANCES_INTENT` — the Portfolio and the Earn
 * marketplace, which always render (see the early return). They run on every
 * chain, and they are where a redirect sends you, so a rule there would prompt
 * on arrival for a chain the surface never needed.
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
    chains
  }: {
    switchAttempted?: boolean;
    chains?: readonly ChainRef[];
  } = {}
): RouteChainAction {
  const supported = chainIdsForIntent(intent);
  // Omitting `chains` means "assume production": every supported chain is a
  // candidate except the dev fork, and names come from the static map. The app
  // always passes them; the default keeps this callable as a pure predicate.
  const configuredIds = chains?.map(chain => chain.id) ?? supported.filter(id => !isTestnetId(id));
  const comingSoonHere = (COMING_SOON_MAP[currentChainId] ?? []).includes(intent);

  const switchTo = (id: number): RouteChainAction => ({ kind: 'switch-network', chainId: id });

  // Portfolio and the Earn marketplace run on every chain and need none in
  // particular, so they take no part in any of this: they never move the wallet
  // and are never redirected. They are also where a user lands after being
  // redirected OFF a module, which is why the two halves must go together —
  // switching here would turn "this product isn't on your chain" into a prompt
  // to change chain anyway, on the surface that had no complaint. Reads run
  // against the configured chain wagmi keeps pinned, and a transaction is
  // stopped by the modal's own guard.
  if (intent === Intent.BALANCES_INTENT) return { kind: 'render' };

  // (a) The chain already in play hosts the module.
  if (supported.includes(currentChainId)) return { kind: 'render' };

  // (b) The module's home chain.
  if (!comingSoonHere && !switchAttempted) {
    const target = chainSwitchTarget(supported, configuredIds);
    if (target !== undefined && target !== currentChainId) return switchTo(target);
  }

  return { kind: 'redirect-home' };
}
