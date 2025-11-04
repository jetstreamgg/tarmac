import {
  lsSkyUsdsRewardAddress,
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

  const skyUsdsRewardAddress = lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress];

  // If user has the USDS reward selected, show all reward options,
  // otherwise filter out the USDS reward
  const rewardContractsToShow = stakeRewardContracts?.filter(({ contractAddress }) =>
    urnSelectedRewardContract?.toLowerCase() === skyUsdsRewardAddress.toLowerCase()
      ? true
      : contractAddress.toLowerCase() !== skyUsdsRewardAddress.toLowerCase()
  );

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
    </div>
  );
};
