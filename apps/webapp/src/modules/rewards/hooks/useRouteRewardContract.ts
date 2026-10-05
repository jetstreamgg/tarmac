import { RewardContract, useAvailableTokenRewardContracts } from '@/hooks';
import { Intent } from '@/lib/enums';
import { useRouteEntityParams, useRouteIntent } from '@/lib/navigation';
import { useTargetChainId } from '@/modules/ui/context/NetworkSwitchContext';

/**
 * Reward contract selected by the current route (`/rewards/$rewardContract`),
 * resolved against the contracts available on the chain the app is pointed at.
 * Undefined outside the rewards detail route or for contracts unknown on that
 * chain.
 *
 * The chain is the route guard's own (`useTargetChainId`, in
 * useAppOrchestration): while a switch is pending it is the switch's target,
 * not the chain the wallet is leaving. Resolving against the wallet's chain
 * instead left a wallet parked on an unconfigured network with a page that
 * found no contract while the guard, judging the target, found one and never
 * redirected — an empty page for as long as the wallet sat on the request
 * (APP-591). While parked, the page reads against the configured chain wagmi
 * keeps pinned, like every other module, and the transaction modal's chain
 * guard holds any write.
 */
export function useRouteRewardContract(): RewardContract | undefined {
  const intent = useRouteIntent();
  const { rewardContract } = useRouteEntityParams();
  const chainId = useTargetChainId(intent);

  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  return intent === Intent.REWARDS_INTENT && rewardContract
    ? rewardContracts?.find(c => c.contractAddress?.toLowerCase() === rewardContract.toLowerCase())
    : undefined;
}
