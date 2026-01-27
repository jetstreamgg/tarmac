import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  RewardContract,
  useAvailableTokenRewardContracts,
  useRewardContractsToClaim,
  useRewardsWithUserBalance,
  isDeprecatedRewardContract
} from '@jetstreamgg/sky-hooks';
import { useContext, useMemo } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { RewardsAction } from '@widgets/widgets/RewardsWidget/lib/constants';
import { RewardsStatsCard } from './RewardsStatsCard';
import { motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { Button } from '@widgets/components/ui/button';

type RewardsOverviewProps = {
  onSelectRewardContract: (rewardContract: RewardContract) => void;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  claimAllExecute: () => void;
  claimAllPrepared: boolean;
  batchEnabledAndSupported: boolean;
  disclaimer?: React.ReactNode;
};

export const RewardsOverview = ({
  onSelectRewardContract,
  onExternalLinkClicked,
  claimAllExecute,
  claimAllPrepared,
  batchEnabledAndSupported,
  isConnectedAndEnabled = true,
  disclaimer
}: RewardsOverviewProps) => {
  const chainId = useChainId();
  const { address } = useConnection();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const { widgetState, setWidgetState } = useContext(WidgetContext);

  const { data: rewardsWithUserBalance } = useRewardsWithUserBalance({
    address,
    chainId,
    contractAddresses: rewardContracts.map(rewardContract => rewardContract.contractAddress as `0x${string}`)
  });

  const [userRewards, allRewards] = useMemo(() => {
    const userRewards: RewardContract[] = [];
    const allRewards: RewardContract[] = [];

    rewardContracts.forEach(rewardContract => {
      const rewardWithUserBalance = rewardsWithUserBalance?.find(
        reward => reward.rewardContract === rewardContract.contractAddress
      );

      if (!!rewardWithUserBalance && rewardWithUserBalance.userHasBalance) {
        // Keep deprecated rewards in userRewards if user has a balance (existing position)
        userRewards.push(rewardContract);
      } else {
        // Filter out deprecated rewards from allRewards (new users shouldn't see them)
        const isDeprecated = isDeprecatedRewardContract(rewardContract.contractAddress, chainId);
        if (!isDeprecated) {
          allRewards.push(rewardContract);
        }
      }
    });

    return [userRewards, allRewards];
  }, [rewardContracts, rewardsWithUserBalance, chainId]);

  // Check if user has any deprecated positions
  const hasDeprecatedPosition = useMemo(() => {
    return userRewards.some(contract => isDeprecatedRewardContract(contract.contractAddress, chainId));
  }, [userRewards, chainId]);

  const { data: rewardContractsToClaim } = useRewardContractsToClaim({
    rewardContractAddresses: userRewards.map(({ contractAddress }) => contractAddress as `0x${string}`) || [],
    addresses: address,
    chainId,
    enabled: !!userRewards.length && !!address
  });

  const handleRewardContractClick = (rewardContract: RewardContract) => {
    onSelectRewardContract(rewardContract);
    setWidgetState({
      ...widgetState,
      action: RewardsAction.SUPPLY
    });
  };

  return (
    <div className="space-y-4">
      {hasDeprecatedPosition && disclaimer && <div className="mb-2">{disclaimer}</div>}
      {userRewards.length > 0 && (
        <motion.div className="space-y-3" variants={positionAnimations}>
          <Heading tag="h3" variant="medium">
            <Trans>My rewards</Trans>
          </Heading>
          {batchEnabledAndSupported && !!rewardContractsToClaim && rewardContractsToClaim.length > 1 && (
            <Button
              disabled={!claimAllPrepared}
              onClick={claimAllExecute}
              variant="secondary"
              className="w-full"
            >
              Claim all rewards
            </Button>
          )}
          {userRewards.map(rewardContract => (
            <RewardsStatsCard
              key={`${rewardContract.name}${rewardContract.contractAddress}`}
              rewardContract={rewardContract}
              onClick={() => handleRewardContractClick(rewardContract)}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          ))}
        </motion.div>
      )}
      {allRewards.length > 0 && (
        <motion.div className="space-y-3" variants={positionAnimations}>
          <Heading tag="h3" variant="medium">
            <Trans>All rewards</Trans>
          </Heading>
          {allRewards.map(rewardContract => (
            <RewardsStatsCard
              key={`${rewardContract.name}${rewardContract.contractAddress}`}
              rewardContract={rewardContract}
              onClick={() => handleRewardContractClick(rewardContract)}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
};
