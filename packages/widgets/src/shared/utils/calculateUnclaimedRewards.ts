import { formatUnits } from 'viem';
import { TOKENS, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import type { PriceData } from '@jetstreamgg/sky-hooks';

interface UnclaimedRewardData {
  rewardSymbol: string;
  claimBalance: bigint;
}

interface UnclaimedRewardsResult {
  totalUnclaimedRewardsValue: number;
  uniqueRewardTokens: string[];
}

export const calculateUnclaimedRewards = (
  unclaimedRewardsData: UnclaimedRewardData[] | undefined,
  pricesData: Record<string, PriceData> | undefined,
  chainId: number
): UnclaimedRewardsResult => {
  if (!unclaimedRewardsData || !pricesData) {
    return { totalUnclaimedRewardsValue: 0, uniqueRewardTokens: [] };
  }

  const uniqueTokensSet = new Set<string>();
  let totalValue = 0;

  for (const reward of unclaimedRewardsData) {
    const price = pricesData[reward.rewardSymbol]?.price || '0';
    const tokenSymbol = reward.rewardSymbol.toLowerCase() as keyof typeof TOKENS;
    const token = TOKENS[tokenSymbol];

    if (!token) {
      console.warn(`Token ${reward.rewardSymbol} not found in TOKENS`);
      uniqueTokensSet.add(reward.rewardSymbol); // Still track the token for display
      continue;
    }

    const decimals = getTokenDecimals(token, chainId);
    const rewardAmount = parseFloat(formatUnits(reward.claimBalance, decimals));
    totalValue += rewardAmount * parseFloat(price);

    uniqueTokensSet.add(reward.rewardSymbol);
  }

  return {
    totalUnclaimedRewardsValue: totalValue,
    uniqueRewardTokens: Array.from(uniqueTokensSet)
  };
};
