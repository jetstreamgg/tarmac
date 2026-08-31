import { Intent } from './enums';
import { base, mainnet, arbitrum, unichain, optimism } from 'viem/chains';
import { chainId } from '@/utils/chainId';

// Per-chain module availability. Lives in its own Lingui-free module (extracted
// verbatim from lib/constants) so the engine layer (src/hooks) can consume it —
// lib/constants pulls @lingui/core/macro, which the vnet hooks test runner
// cannot transform. lib/constants re-exports both maps, so existing import
// sites are unaffected.
export const CHAIN_WIDGET_MAP: Record<number, Intent[]> = {
  [mainnet.id]: [
    Intent.BALANCES_INTENT,
    Intent.REWARDS_INTENT,
    Intent.SAVINGS_INTENT,
    Intent.UPGRADE_INTENT,
    Intent.TRADE_INTENT,
    Intent.STAKE_INTENT,
    Intent.EXPERT_INTENT,
    Intent.VAULTS_INTENT,
    Intent.CONVERT_INTENT,
    Intent.FIXED_INTENT
  ],
  [chainId.tenderly]: [
    Intent.BALANCES_INTENT,
    Intent.REWARDS_INTENT,
    Intent.SAVINGS_INTENT,
    Intent.UPGRADE_INTENT,
    Intent.TRADE_INTENT,
    Intent.STAKE_INTENT,
    Intent.EXPERT_INTENT,
    Intent.VAULTS_INTENT,
    Intent.CONVERT_INTENT,
    Intent.FIXED_INTENT
  ],
  [base.id]: [Intent.BALANCES_INTENT, Intent.SAVINGS_INTENT, Intent.TRADE_INTENT, Intent.CONVERT_INTENT],
  [arbitrum.id]: [Intent.BALANCES_INTENT, Intent.SAVINGS_INTENT, Intent.TRADE_INTENT, Intent.CONVERT_INTENT],
  [unichain.id]: [Intent.BALANCES_INTENT, Intent.SAVINGS_INTENT, Intent.TRADE_INTENT, Intent.CONVERT_INTENT],
  [optimism.id]: [Intent.BALANCES_INTENT, Intent.SAVINGS_INTENT, Intent.TRADE_INTENT, Intent.CONVERT_INTENT]
};

export const COMING_SOON_MAP: Record<number, Intent[]> = {
  // Rewards is now treated as a mainnet-only module with auto-switching
  // [base.id]: [Intent.YOUR_INTENT] // Example of how to add a coming soon intent
};

/**
 * The Ethereum-mainnet family: real mainnet plus the Tenderly fork that stands
 * in for it in dev. This is the `supportedChainIds` every mainnet-only product
 * flow declares on its transaction config — vaults, rewards, stUSDS, Pendle,
 * upgrade, stake, claim (see `TransactionConfig.supportedChainIds`). A connected
 * wallet on any other chain (an L2) would resolve these products' addresses to a
 * different chain's map entry — or none — so the transaction modal's chain guard
 * blocks it and offers a switch back. Multi-chain products (savings, convert)
 * derive their set from `chainIdsForIntent` instead.
 */
export const MAINNET_FAMILY_CHAIN_IDS: number[] = [mainnet.id, chainId.tenderly];

/**
 * Every chain that offers a given product, straight from the availability map
 * (minus any coming-soon holds). This is the `supportedChainIds` a multi-chain
 * product flow (savings, convert) declares on its transaction config — a pure,
 * hook-free derivation, so it can be a module-level constant rather than a
 * `useChains`-backed hook read. Independent of the wallet config: the guard only
 * ever compares against the live wallet chain, which is itself always a
 * configured chain, and `chainSwitchTarget` re-filters by the configured set
 * when choosing where to switch.
 */
export function chainIdsForIntent(intent: Intent): number[] {
  return Object.keys(CHAIN_WIDGET_MAP)
    .map(Number)
    .filter(id => CHAIN_WIDGET_MAP[id].includes(intent) && !(COMING_SOON_MAP[id] ?? []).includes(intent));
}

/**
 * The chain a guarded transaction modal should offer to switch to when the
 * wallet has left a flow's `supportedChainIds`. Prefers the dev fork when it's
 * both supported and configured (so a dev wallet never gets switched onto real
 * Ethereum and real fees), then real mainnet, then any supported chain the
 * wallet config actually knows — mirroring the fork-aware picks in
 * `usePortfolioSupplyActions` / `usePendleRedeemModal`. Returns `undefined` only
 * when none of the supported chains are in the wallet config (nothing to offer).
 */
export function chainSwitchTarget(
  supportedChainIds: number[],
  configuredChainIds: readonly number[]
): number | undefined {
  const configured = (id: number) => configuredChainIds.includes(id);
  return (
    supportedChainIds.find(id => id === chainId.tenderly && configured(id)) ??
    supportedChainIds.find(id => id === mainnet.id && configured(id)) ??
    supportedChainIds.find(configured)
  );
}
