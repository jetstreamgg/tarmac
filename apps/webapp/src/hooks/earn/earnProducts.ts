import { Intent } from '@/lib/enums';
import { CHAIN_WIDGET_MAP, COMING_SOON_MAP } from '@/lib/chainAvailability';
import { intentToPath } from '@/lib/routes';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { TOKENS } from '../tokens/tokens.constants';
import { VAULTS } from '../vaults/constants';
import { PENDLE_MARKETS } from '../pendle/constants';
import type { RewardContract } from '../rewards/rewards';
import { rewardContractDisplayName } from '../rewards/rewardContractDisplayName';
import type { EarnProductDescriptor, EarnRiskProfileId, EarnRiskTier } from './types';

/**
 * The single source of truth for the (BL-07 hardcoded) tier per risk profile —
 * the marketplace registry below and every standalone risk surface (product
 * detail pages, portfolio cards) read from here, so the list and the detail
 * page can never diverge for the same product. Assignments come from the risk
 * sheet Kacper posted on APP-396 (initial draft, 2026-07-20): Conservative →
 * savings + every rewards farm, Moderate → USDS Flagship / USDT Savings /
 * Pendle fixed yield, Aggressive → stUSDS + the Risk Capital vaults.
 * 'vault-tether-savings' (flag-gated sUSDT) and the generic 'rewards' fallback
 * are not in the sheet — placeholder tiers pending a product assessment.
 */
export const RISK_TIER_BY_PROFILE: Record<EarnRiskProfileId, EarnRiskTier> = {
  savings: 'low',
  rewards: 'low',
  'rewards-sky': 'low',
  'rewards-spk': 'low',
  'rewards-grove': 'low',
  'rewards-cle': 'low',
  'vault-flagship': 'moderate',
  'vault-usdt-savings': 'moderate',
  'vault-tether-savings': 'moderate',
  'vault-risk-capital': 'advanced',
  fixed: 'moderate',
  stusds: 'advanced'
};

/**
 * Profile per reward token — each farm names its own reward in the details
 * copy. Unknown tokens fall back to the generic reward-agnostic 'rewards'
 * profile so a newly registered farm renders sane copy until it gets its own.
 */
const REWARDS_RISK_PROFILES: Record<string, EarnRiskProfileId> = {
  SKY: 'rewards-sky',
  SPK: 'rewards-spk',
  GROVE: 'rewards-grove',
  CLE: 'rewards-cle'
};

export function rewardsRiskProfile(rewardTokenSymbol: string): EarnRiskProfileId {
  return REWARDS_RISK_PROFILES[rewardTokenSymbol] ?? 'rewards';
}

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
    risk: RISK_TIER_BY_PROFILE.savings,
    riskProfile: 'savings',
    networks: productNetworks(Intent.SAVINGS_INTENT, familyChainIds, TOKENS.susds.address),
    detailPath: intentToPath(Intent.SAVINGS_INTENT)
  };

  const rewards: EarnProductDescriptor[] = rewardContracts.map(contract => {
    const riskProfile = rewardsRiskProfile(contract.rewardToken.symbol);
    return {
      id: `rewards-${contract.rewardToken.symbol.toLowerCase()}`,
      kind: 'rewards',
      intent: Intent.REWARDS_INTENT,
      // Marketplace rows read "<TOKEN> Rewards" (APP-526); the registry name stays
      // "Earn <TOKEN>" for analytics parity.
      name: rewardContractDisplayName(contract),
      tokenSymbol: contract.supplyToken.symbol,
      supplyTokens: [contract.supplyToken.symbol],
      risk: RISK_TIER_BY_PROFILE[riskProfile],
      riskProfile,
      networks: productNetworks(Intent.REWARDS_INTENT, familyChainIds),
      detailPath: intentToPath(Intent.REWARDS_INTENT, contract.contractAddress),
      // RewardContract types its address as plain string; the values come from
      // the generated per-chain address maps.
      address: contract.contractAddress as `0x${string}`
    };
  });

  const vaults: EarnProductDescriptor[] = VAULTS.map(vault => {
    const address = vault.vaultAddress[familyMainnetId];
    return {
      id: `vault-${vault.provider}-${(address ?? vault.name).toLowerCase()}`,
      kind: 'vault',
      intent: Intent.VAULTS_INTENT,
      name: vault.name,
      tokenSymbol: vault.assetToken.symbol,
      supplyTokens: [vault.assetToken.symbol],
      risk: RISK_TIER_BY_PROFILE[vault.riskProfile],
      riskProfile: vault.riskProfile,
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
    risk: RISK_TIER_BY_PROFILE.fixed,
    riskProfile: 'fixed',
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
    risk: RISK_TIER_BY_PROFILE.stusds,
    riskProfile: 'stusds',
    networks: productNetworks(Intent.EXPERT_INTENT, familyChainIds),
    // The Expert module flattened into its single product at /earn/stusds (D7).
    detailPath: intentToPath(Intent.EXPERT_INTENT)
  };

  return [savings, ...rewards, ...vaults, ...fixed, stusds];
}
