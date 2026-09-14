import { RewardContract, useAppChainId, useAvailableTokenRewardContracts } from '@/hooks';
import { Intent } from '@/lib/enums';
import { useRouteEntityParams, useRouteIntent } from '@/lib/navigation';

/**
 * Reward contract selected by the current route (`/rewards/$rewardContract`),
 * resolved against the contracts available on the chain the app is pointed at.
 * Undefined outside the rewards detail route or for contracts unknown on that
 * chain.
 *
 * This used to re-derive the chain from `?network=`, which is how it stayed in
 * step with the route validation in useAppOrchestration — both read the same
 * ambient URL. `useAppChainId` is that shared derivation now.
 */
export function useRouteRewardContract(): RewardContract | undefined {
  const intent = useRouteIntent();
  const { rewardContract } = useRouteEntityParams();
  const chainId = useAppChainId();

  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  return intent === Intent.REWARDS_INTENT && rewardContract
    ? rewardContracts?.find(c => c.contractAddress?.toLowerCase() === rewardContract.toLowerCase())
    : undefined;
}
