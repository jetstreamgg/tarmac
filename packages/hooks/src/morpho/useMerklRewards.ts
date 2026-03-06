import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChainId, useConnection } from 'wagmi';
import { useCallback } from 'react';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { isTestnetId, formatBigInt } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { MERKL_API_URL, MORPHO_VAULTS, getMorphoVaultByAddress } from './constants';

/**
 * Token data from the Merkl API response.
 */
type MerklTokenData = {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  price: number;
};

/**
 * Breakdown data for a reward (explains where the reward comes from).
 */
type MerklRewardBreakdown = {
  root: string;
  distributionChainId: number;
  reason: string;
  amount: string;
  claimed: string;
  pending: string;
  campaignId: string;
  subCampaignId: string;
};

/**
 * Individual reward data from the Merkl API.
 */
type MerklRewardData = {
  root: string;
  distributionChainId: number;
  recipient: string;
  amount: string;
  claimed: string;
  pending: string;
  proofs: string[];
  token: MerklTokenData;
  breakdowns: MerklRewardBreakdown[];
};

/**
 * Chain data from the Merkl API response.
 */
type MerklChainData = {
  endOfDisputePeriod: number;
  id: number;
  name: string;
  icon: string;
  liveCampaigns: number;
};

/**
 * API response structure for Merkl rewards endpoint.
 */
type MerklRewardsApiResponse = {
  chain: MerklChainData;
  rewards: MerklRewardData[];
}[];

/** Source breakdown for a reward token (e.g., a specific vault or other campaigns) */
export type MerklRewardSource = {
  /** Human-readable label for this source */
  label: string;
  /** Amount from this source (raw bigint) */
  amount: bigint;
  /** Formatted amount (e.g., "10.00") */
  formattedAmount: string;
  /** Vault address if this source is a known Morpho vault */
  vaultAddress?: `0x${string}`;
};

/** Aggregated reward data for a single token across all sources */
export type MerklTokenReward = {
  /** Reward token address */
  tokenAddress: `0x${string}`;
  /** Reward token symbol (e.g., "MORPHO", "USDS") */
  tokenSymbol: string;
  /** Reward token decimals */
  tokenDecimals: number;
  /** Token price in USD */
  tokenPrice: number;
  /** Total claimable amount across all sources (raw bigint) - this is what gets sent to the contract */
  totalAmount: bigint;
  /** Amount already claimed (raw bigint) */
  claimed: bigint;
  /** Formatted total amount */
  formattedTotalAmount: string;
  /** Total amount value in USD */
  totalAmountUsd: number;
  /** Breakdown by source (vaults, other campaigns) */
  sources: MerklRewardSource[];
  /** Merkle proofs for claiming */
  proofs: string[];
  /** Merkle root for the distribution */
  root: string;
  /** Chain ID where rewards can be claimed */
  distributionChainId: number;
};

export type MerklRewardsData = {
  /** List of rewards grouped by token */
  rewards: MerklTokenReward[];
  /** Whether the user has any claimable rewards */
  hasClaimableRewards: boolean;
};

export type MerklRewardsHook = ReadHook & {
  data?: MerklRewardsData;
};

/**
 * Check if a breakdown reason corresponds to a known Morpho vault.
 * Returns the vault address if found, undefined otherwise.
 */
function findVaultAddressInReason(reason: string, chainId: number): `0x${string}` | undefined {
  const lowerReason = reason.toLowerCase();
  for (const vault of MORPHO_VAULTS) {
    const addr = vault.vaultAddress[chainId];
    if (addr && lowerReason.includes(addr.toLowerCase())) {
      return addr;
    }
  }
  return undefined;
}

/**
 * Fetch all user rewards from the Merkl API and break them down by source.
 */
async function fetchMerklRewards(
  userAddress: `0x${string}`,
  chainId: number,
  forceReload?: boolean
): Promise<MerklRewardsData | undefined> {
  const params = new URLSearchParams({
    chainId: String(chainId),
    breakdownPage: '0',
    claimableOnly: 'true'
  });
  if (forceReload) {
    params.set('reloadChainId', String(chainId));
  }
  const url = `${MERKL_API_URL}/users/${userAddress}/rewards?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Merkl API error: ${response.status}`);
  }

  const result: MerklRewardsApiResponse = await response.json();
  const chainRewards = result.find(r => r.chain.id === chainId);

  if (!chainRewards || chainRewards.rewards.length === 0) {
    return { rewards: [], hasClaimableRewards: false };
  }

  const tokenRewards: MerklTokenReward[] = [];

  for (const reward of chainRewards.rewards) {
    const { token, proofs, root, distributionChainId } = reward;

    // Group breakdowns by source
    const vaultAmounts = new Map<`0x${string}`, bigint>();
    let otherAmount = 0n;

    for (const breakdown of reward.breakdowns) {
      const breakdownAmount = BigInt(breakdown.amount) - BigInt(breakdown.claimed);
      if (breakdownAmount <= 0n) continue;

      const vaultAddr = findVaultAddressInReason(breakdown.reason, chainId);
      if (vaultAddr) {
        vaultAmounts.set(vaultAddr, (vaultAmounts.get(vaultAddr) ?? 0n) + breakdownAmount);
      } else {
        otherAmount += breakdownAmount;
      }
    }

    // Only include tokens that have some unclaimed amount and at least one known vault source
    const totalPending = BigInt(reward.amount) - BigInt(reward.claimed);
    if (totalPending <= 0n) continue;
    if (vaultAmounts.size === 0) continue;

    // Build sources array
    const sources: MerklRewardSource[] = [];

    for (const [vaultAddr, amount] of vaultAmounts) {
      const vaultConfig = getMorphoVaultByAddress(vaultAddr, chainId);
      sources.push({
        label: vaultConfig?.name ?? 'Unknown Vault',
        amount,
        formattedAmount: formatBigInt(amount, { unit: token.decimals, compact: false, maxDecimals: 2 }),
        vaultAddress: vaultAddr
      });
    }

    if (otherAmount > 0n) {
      sources.push({
        label: 'Other campaigns',
        amount: otherAmount,
        formattedAmount: formatBigInt(otherAmount, { unit: token.decimals, compact: false, maxDecimals: 2 })
      });
    }

    // Use the full cumulative amount for claiming (contract expects total earned)
    const totalAmount = BigInt(reward.amount);
    const claimed = BigInt(reward.claimed);
    const totalAmountUsd = parseFloat(formatUnits(totalPending, token.decimals)) * token.price;

    tokenRewards.push({
      tokenAddress: token.address as `0x${string}`,
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      tokenPrice: token.price,
      totalAmount,
      claimed,
      formattedTotalAmount: formatBigInt(totalPending, { unit: token.decimals, compact: false, maxDecimals: 2 }),
      totalAmountUsd,
      sources,
      proofs,
      root,
      distributionChainId
    });
  }

  return {
    rewards: tokenRewards,
    hasClaimableRewards: tokenRewards.length > 0
  };
}

/**
 * Hook for fetching all Merkl rewards for the connected user, grouped by token
 * with a breakdown by source (which Morpho vault, other campaigns).
 *
 * Unlike useMorphoVaultRewards which filters to a single vault, this hook
 * returns all rewards and their full source breakdown. The claim contract
 * claims the full amount per token, so this gives users transparency about
 * what they're claiming.
 */
export function useMerklRewards(): MerklRewardsHook {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? mainnet.id : connectedChainId;

  const queryClient = useQueryClient();
  const queryKey = ['merkl-rewards-all', userAddress, chainId];

  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (!userAddress) {
        throw new Error('User address not available');
      }
      return fetchMerklRewards(userAddress, chainId);
    },
    enabled: !!userAddress,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const mutate = useCallback(() => {
    if (!userAddress) return;
    void queryClient.prefetchQuery({
      queryKey,
      queryFn: () => fetchMerklRewards(userAddress, chainId, true),
      staleTime: 0
    });
  }, [queryClient, queryKey, userAddress, chainId]);

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Merkl API',
        href: MERKL_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
