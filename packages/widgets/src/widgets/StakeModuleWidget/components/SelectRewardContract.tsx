import {
  useStakeRewardContracts,
  useStakeUrnSelectedRewardContract,
  ZERO_ADDRESS,
  lsSkyUsdsRewardAddress
} from '@jetstreamgg/sky-hooks';
import { SaRewardsCard } from './SaRewardsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { Card } from '@widgets/components/ui/card';
import { useContext, useEffect, useMemo } from 'react';
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

  // Filter out USDS reward unless user's current reward is already USDS
  const filteredRewardContracts = useMemo(() => {
    if (!stakeRewardContracts) return stakeRewardContracts;

    const usdsRewardAddress = lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress];
    const currentRewardIsUsds =
      urnSelectedRewardContract?.toLowerCase() === usdsRewardAddress?.toLowerCase();

    // If current reward is USDS, show all options (including USDS)
    if (currentRewardIsUsds) {
      return stakeRewardContracts;
    }

    // Otherwise, filter out USDS from the options
    return stakeRewardContracts.filter(
      ({ contractAddress }) => contractAddress.toLowerCase() !== usdsRewardAddress?.toLowerCase()
    );
  }, [stakeRewardContracts, urnSelectedRewardContract, chainId]);

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

  return (
    <div>
      <div>
        <HStack className="mb-3 items-baseline justify-between">
          <div>
            <Text>
              <Trans>Choose your reward token</Trans>
            </Text>
            <Text variant="small" className="leading-4">
              <Trans>(More rewards coming soon)</Trans>
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
        {isLoading || !filteredRewardContracts ? (
          <Card>
            <Skeleton />
          </Card>
        ) : (
          filteredRewardContracts?.map(({ contractAddress }) => (
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
    </div>
  );
};
