import { Intent } from '@/lib/enums';
import { CHAIN_WIDGET_MAP, COMING_SOON_MAP } from '@/lib/chainAvailability';
import { intentToPath } from '@/lib/routes';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { TOKENS } from '../tokens/tokens.constants';
import { VAULTS } from '../vaults/constants';
import { PENDLE_MARKETS } from '../pendle/constants';
import type { RewardContract } from '../rewards/rewards';
import type { EarnProductDescriptor, EarnRiskTier } from './types';

// TODO(BL-07): hardcoded risk tiers — see EarnRiskTier in ./types.ts.
const DEFAULT_RISK_TIER: EarnRiskTier = 'moderate';
const STUSDS_RISK_TIER: EarnRiskTier = 'advanced';
// TESTING ONLY — NOT a risk assessment. 'low' makes the Conservative details
// surface (APP-396) reachable in the app, matching the comps that show Sky
// Savings as Conservative. The real tier assignment is a product/risk
// decision owned by BL-07, not engineering; revisit before this ships.
const SAVINGS_RISK_TIER: EarnRiskTier = 'low';

/**
 * Chains within `familyChainIds` where a product is live: its owning module
 * must be enabled for the chain (the existing availability config, reused
 * unchanged) and, when the product is address-bound, the address map must
 * have an entry for the chain.
 */
export function productNetworks(
  intent: Intent,
  familyChainIds: number[],
  addressMap?: Record<number, unknown>
): number[] {
  return familyChainIds.filter(
    id =>
      (CHAIN_WIDGET_MAP[id] ?? []).includes(intent) &&
      !(COMING_SOON_MAP[id] ?? []).includes(intent) &&
      (addressMap === undefined || addressMap[id] !== undefined)
  );
}

/**
 * The static-length EarnProduct registry: one descriptor per product instance
 * (savings, each active rewards contract, each vault, each PT market, stUSDS).
 * Pure — callers pass the active chain family and the chain-resolved rewards
 * list (from useAvailableTokenRewardContracts, deprecated already filtered).
 * Matured Pendle markets keep their registry slot (static length) but are
 * expected to be skipped by consumers via `maturity`.
 */
export function buildEarnProducts(
  familyChainIds: number[],
  familyMainnetId: number,
  rewardContracts: RewardContract[]
): EarnProductDescriptor[] {
  const savings: EarnProductDescriptor = {
    id: 'savings',
    kind: 'savings',
    intent: Intent.SAVINGS_INTENT,
    name: 'Sky Savings Rate',
    tokenSymbol: TOKENS.susds.symbol,
    // USDS deposits directly; DAI is accepted via the 1:1 upgrade to USDS
    // (mainnet); USDC swaps through the PSM (L2). The union across the family is
    // listed here — the supply surface offers the chain-appropriate subset.
    supplyTokens: [TOKENS.usds.symbol, TOKENS.dai.symbol, TOKENS.usdc.symbol],
    risk: SAVINGS_RISK_TIER,
    networks: productNetworks(Intent.SAVINGS_INTENT, familyChainIds, TOKENS.susds.address),
    detailPath: intentToPath(Intent.SAVINGS_INTENT)
  };

  const rewards: EarnProductDescriptor[] = rewardContracts.map(contract => ({
    id: `rewards-${contract.rewardToken.symbol.toLowerCase()}`,
    kind: 'rewards',
    intent: Intent.REWARDS_INTENT,
    name: contract.name,
    tokenSymbol: contract.supplyToken.symbol,
    supplyTokens: [contract.supplyToken.symbol],
    risk: DEFAULT_RISK_TIER,
    networks: productNetworks(Intent.REWARDS_INTENT, familyChainIds),
    detailPath: intentToPath(Intent.REWARDS_INTENT, contract.contractAddress),
    // RewardContract types its address as plain string; the values come from
    // the generated per-chain address maps.
    address: contract.contractAddress as `0x${string}`
  }));

  const vaults: EarnProductDescriptor[] = VAULTS.map(vault => {
    const address = vault.vaultAddress[familyMainnetId];
    return {
      id: `vault-${vault.provider}-${(address ?? vault.name).toLowerCase()}`,
      kind: 'vault',
      intent: Intent.VAULTS_INTENT,
      name: vault.name,
      tokenSymbol: vault.assetToken.symbol,
      supplyTokens: [vault.assetToken.symbol],
      risk: DEFAULT_RISK_TIER,
      networks: productNetworks(Intent.VAULTS_INTENT, familyChainIds, vault.vaultAddress),
      detailPath: intentToPath(Intent.VAULTS_INTENT, `${vaultModuleForProvider(vault.provider)}/${address}`),
      address
    };
  });

  const fixed: EarnProductDescriptor[] = PENDLE_MARKETS.map(market => ({
    id: `fixed-${market.marketAddress.toLowerCase()}`,
    kind: 'fixed',
    intent: Intent.FIXED_INTENT,
    name: market.name,
    tokenSymbol: market.underlyingSymbol,
    // The Pendle buy flow accepts these input tokens (direct or via the SY
    // aggregator route).
    supplyTokens: [TOKENS.usds.symbol, TOKENS.usdc.symbol, TOKENS.susds.symbol],
    risk: DEFAULT_RISK_TIER,
    networks: productNetworks(Intent.FIXED_INTENT, familyChainIds),
    detailPath: intentToPath(Intent.FIXED_INTENT, market.slug),
    maturity: market.expiry,
    address: market.marketAddress
  }));

  const stusds: EarnProductDescriptor = {
    id: 'stusds',
    kind: 'stusds',
    intent: Intent.EXPERT_INTENT,
    name: 'stUSDS',
    tokenSymbol: TOKENS.stusds.symbol,
    supplyTokens: [TOKENS.usds.symbol],
    risk: STUSDS_RISK_TIER,
    networks: productNetworks(Intent.EXPERT_INTENT, familyChainIds),
    // The Expert module flattened into its single product at /earn/stusds (D7).
    detailPath: intentToPath(Intent.EXPERT_INTENT)
  };

  return [savings, ...rewards, ...vaults, ...fixed, stusds];
}
