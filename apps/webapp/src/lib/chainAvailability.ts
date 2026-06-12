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
