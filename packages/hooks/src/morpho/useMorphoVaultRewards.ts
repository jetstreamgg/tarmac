import { useQuery } from '@tanstack/react-query';
import { useChainId, useConnection } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { isTestnetId, formatBigInt } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { MERKL_API_URL } from './constants';

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

/** Processed reward data for a single token */
export type MorphoVaultReward = {
  /** Reward token address */
  tokenAddress: `0x${string}`;
  /** Reward token symbol (e.g., "MORPHO") */
  tokenSymbol: string;
  /** Reward token decimals */
  tokenDecimals: number;
  /** Token price in USD */
  tokenPrice: number;
  /** Total accumulated reward amount (raw bigint) */
  amount: bigint;
  /** Amount already claimed (raw bigint) */
  claimed: bigint;
  /** Amount pending/claimable (raw bigint) */
  pending: bigint;
  /** Formatted total amount (e.g., "2.65") */
  formattedAmount: string;
  /** Formatted claimed amount */
  formattedClaimed: string;
  /** Formatted pending amount */
  formattedPending: string;
  /** Total amount value in USD */
  amountUsd: number;
  /** Pending amount value in USD */
  pendingUsd: number;
  /** Merkle proofs for claiming */
  proofs: string[];
  /** Merkle root for the distribution */
  root: string;
  /** Chain ID where rewards can be claimed */
  distributionChainId: number;
};

export type MorphoVaultRewardsData = {
  /** List of rewards by token */
  rewards: MorphoVaultReward[];
  /** Total pending rewards value in USD */
  totalPendingUsd: number;
  /** Formatted total pending USD (e.g., "$2.95") */
  formattedTotalPendingUsd: string;
  /** Whether the user has any claimable rewards */
  hasClaimableRewards: boolean;
};

export type MorphoVaultRewardsHook = ReadHook & {
  data?: MorphoVaultRewardsData;
};

/**
 * Filter rewards to only include those related to a given Morpho vaults.
 * Morpho vault rewards have a reason string containing "MorphoVault" or "MorphoVaultV2".
 */
function isMorphoVaultReward(breakdown: MerklRewardBreakdown, vaultAddress: `0x${string}`): boolean {
  return (
    breakdown.reason.includes('MorphoVault') &&
    breakdown.reason.toLowerCase().includes(vaultAddress.toLowerCase())
  );
}

/**
 * Fetch user rewards from the Merkl API.
 */
async function fetchMorphoVaultRewards(
  userAddress: `0x${string}`,
  vaultAddress: `0x${string}`,
  chainId: number
): Promise<MorphoVaultRewardsData | undefined> {
  const url = `${MERKL_API_URL}/users/${userAddress}/rewards?chainId=${chainId}&breakdownPage=0&claimableOnly=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Merkl API error: ${response.status}`);
  }

  const result: MerklRewardsApiResponse = await response.json();

  // Find rewards for the specified chain
  const chainRewards = result.find(r => r.chain.id === chainId);

  if (!chainRewards || chainRewards.rewards.length === 0) {
    return {
      rewards: [],
      totalPendingUsd: 0,
      formattedTotalPendingUsd: '$0.00',
      hasClaimableRewards: false
    };
  }

  // Filter and process rewards that are related to Morpho vaults
  const morphoRewards: MorphoVaultReward[] = [];

  for (const reward of chainRewards.rewards) {
    // Check if any breakdown is from a Morpho vault and the vault corresponds to the given vault address
    const morphoBreakdowns = reward.breakdowns.filter(breakdown =>
      isMorphoVaultReward(breakdown, vaultAddress)
    );

    if (morphoBreakdowns.length === 0) {
      continue;
    }

    // Calculate the portion of rewards from Morpho vaults
    const morphoAmount = morphoBreakdowns.reduce((sum, b) => sum + BigInt(b.amount), 0n);
    const morphoClaimed = morphoBreakdowns.reduce((sum, b) => sum + BigInt(b.claimed), 0n);
    const morphoPending = morphoBreakdowns.reduce((sum, b) => sum + BigInt(b.pending), 0n);

    const { token, proofs, root, distributionChainId } = reward;

    // Calculate USD values
    const pendingDecimal = Number(morphoPending) / Math.pow(10, token.decimals);
    const amountDecimal = Number(morphoAmount) / Math.pow(10, token.decimals);
    const pendingUsd = pendingDecimal * token.price;
    const amountUsd = amountDecimal * token.price;

    morphoRewards.push({
      tokenAddress: token.address as `0x${string}`,
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      tokenPrice: token.price,
      amount: morphoAmount,
      claimed: morphoClaimed,
      pending: morphoPending,
      formattedAmount: formatBigInt(morphoAmount, { unit: token.decimals, compact: false, maxDecimals: 2 }),
      formattedClaimed: formatBigInt(morphoClaimed, { unit: token.decimals, compact: false, maxDecimals: 2 }),
      formattedPending: formatBigInt(morphoPending, { unit: token.decimals, compact: false, maxDecimals: 2 }),
      amountUsd,
      pendingUsd,
      proofs,
      root,
      distributionChainId
    });
  }

  // Calculate totals
  const totalPendingUsd = morphoRewards.reduce((sum, r) => sum + r.pendingUsd, 0);
  const hasClaimableRewards = morphoRewards.some(r => r.pending > 0n);

  return {
    rewards: morphoRewards,
    totalPendingUsd,
    formattedTotalPendingUsd: `$${totalPendingUsd.toFixed(2)}`,
    hasClaimableRewards
  };
}

/**
 * Hook for fetching Morpho vault rewards from the Merkl API.
 *
 * This hook fetches reward data for the connected user, filtering to only include
 * rewards earned from Morpho vault deposits into a given vault (identified by "MorphoVault" in the breakdown reason).
 *
 * Returns reward amounts, USD values, and merkle proofs needed for claiming.
 */
export function useMorphoVaultRewards({
  vaultAddress
}: {
  vaultAddress: `0x${string}`;
}): MorphoVaultRewardsHook {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? mainnet.id : connectedChainId;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-rewards', userAddress, vaultAddress, chainId],
    queryFn: () => {
      if (!userAddress) {
        throw new Error('User address not available');
      }
      return fetchMorphoVaultRewards(userAddress, vaultAddress, chainId);
    },
    enabled: !!userAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000 // 5 minutes
  });

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
