import {
  filterDeprecatedRewards,
  lsSkySpkRewardAddress,
  useStakeRewardContracts,
  useStakeUrnSelectedRewardContract,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { SaRewardsCard } from './SaRewardsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { Card } from '@widgets/components/ui/card';
import { useContext, useEffect } from 'react';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Trans } from '@lingui/react/macro';
import { Button } from '@widgets/components/ui/button';
import { Text } from '@widgets/shared/components/ui/Typography';
import { StakeModuleWidgetContext } from '../context/context';
import { getNextStep } from '../lib/utils';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeFlow } from '../lib/constants';
import { useChainId } from 'wagmi';
import { YellowWarning } from '@widgets/shared/components/icons/YellowWarning';

export const SelectRewardContract = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { widgetState } = useContext(WidgetContext);
  const chainId = useChainId();
  const {
    selectedRewardContract,
    setSelectedRewardContract,
    setIsSelectRewardContractCompleted,
    currentStep,
    setCurrentStep,
    activeUrn,
    wantsToDelegate
  } = useContext(StakeModuleWidgetContext);

  // TODO handle error
  const { data: stakeRewardContracts, isLoading /*, error */ } = useStakeRewardContracts();
  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  useEffect(() => {
    setIsSelectRewardContractCompleted(!!selectedRewardContract);
  }, [selectedRewardContract]);

  const handleSkip = () => {
    // If this is an open flow, `urnSelectedRewardContract` would be undefined,
    // if it's a manage flow, it would default to the reward the user previously selected
    setSelectedRewardContract(urnSelectedRewardContract);
    // When we skip, we still set the step to complete
    setIsSelectRewardContractCompleted(true);
    setCurrentStep(getNextStep(currentStep, !wantsToDelegate));
  };

  // Filter out deprecated rewards, but keep the user's current selection visible
  // so they can change away from it
  const rewardContractsToShow = filterDeprecatedRewards(
    stakeRewardContracts || [],
    chainId,
    urnSelectedRewardContract
  );

  // Check if user's current reward is SPK (deprecated)
  const isCurrentRewardSpk =
    urnSelectedRewardContract?.toLowerCase() ===
    lsSkySpkRewardAddress[chainId as keyof typeof lsSkySpkRewardAddress]?.toLowerCase();

  // Auto-select and auto-advance when only one reward option exists (OPEN flow only)
  useEffect(() => {
    if (
      rewardContractsToShow?.length === 1 &&
      !selectedRewardContract &&
      widgetState.flow === StakeFlow.OPEN
    ) {
      const singleReward = rewardContractsToShow[0].contractAddress;
      setSelectedRewardContract(singleReward);
      setIsSelectRewardContractCompleted(true);
      // Auto-advance to next step
      setCurrentStep(getNextStep(currentStep, !wantsToDelegate));
    }
  }, [rewardContractsToShow?.length, selectedRewardContract, widgetState.flow]);

  return (
    <div>
      <div>
        <HStack className="mb-3 items-baseline justify-between">
          <div>
            <Text>
              <Trans>Choose your reward token</Trans>
            </Text>
          </div>
          {widgetState.flow !== StakeFlow.OPEN && (
            <Button variant="link" className="text-white" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </HStack>
      </div>
      <VStack className="py-3">
        {isLoading || !rewardContractsToShow ? (
          <Card>
            <Skeleton />
          </Card>
        ) : (
          rewardContractsToShow?.map(({ contractAddress }) => (
            <SaRewardsCard
              key={contractAddress}
              contractAddress={contractAddress}
              selectedRewardContract={selectedRewardContract}
              setSelectedRewardContract={setSelectedRewardContract}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          ))
        )}
      </VStack>
      {isCurrentRewardSpk && (
        <HStack gap={2} className="mt-3 items-start">
          <YellowWarning boxSize={16} viewBox="0 0 16 16" className="mt-0.5 shrink-0" />
          <Text className="text-textSecondary text-sm">
            <Trans>
              Please <span className="font-bold text-white">choose another reward.</span> The SPK rewards are
              disabled as a Staking Reward option, and the SPK rate set to zero. The pool of SPK will remain
              forever so that you can claim your rewards anytime.
            </Trans>
          </Text>
        </HStack>
      )}
    </div>
  );
};
