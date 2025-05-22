import {
  // useSaRewardContracts,
  useStakeRewardContracts
  // useUrnSelectedRewardContract, ZERO_ADDRESS
} from '@jetstreamgg/hooks';
// import { SaRewardsCard } from './SaRewardsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { Card } from '@widgets/components/ui/card';
import { useContext, useEffect } from 'react';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Trans } from '@lingui/react/macro';
import { Button } from '@widgets/components/ui/button';
import { Text } from '@widgets/shared/components/ui/Typography';
import { SealModuleWidgetContext } from '../context/context';
import { getNextStep } from '../lib/utils';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { NoResults, SealFlow } from '@widgets/index';
import { SaRewardsCard } from '@widgets/widgets/StakeModuleWidget/components/SaRewardsCard';

export const MigrateSelectRewardContract = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { widgetState } = useContext(WidgetContext);
  const {
    selectedRewardContract,
    setSelectedRewardContract,
    setIsSelectRewardContractCompleted,
    currentStep,
    setCurrentStep
    // activeUrn
  } = useContext(SealModuleWidgetContext);

  // Use the stake hook here because we're opening a staking position and need the stake reward contracts
  const { data: lseRewardContracts, isLoading /*, error */ } = useStakeRewardContracts();
  // const { data: urnSelectedRewardContract } = useUrnSelectedRewardContract({
  //   urn: activeUrn?.urnAddress || ZERO_ADDRESS
  // });

  useEffect(() => {
    setIsSelectRewardContractCompleted(!!selectedRewardContract);
  }, [selectedRewardContract]);

  const handleSkip = () => {
    // If this is an open flow, `urnSelectedRewardContract` would be undefined,
    // if it's a manage flow, it would default to the reward the user previously selected
    // setSelectedRewardContract(urnSelectedRewardContract);
    // When we skip, we still set the step to complete
    setIsSelectRewardContractCompleted(true);
    setCurrentStep(getNextStep(currentStep));
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
              <Trans>More rewards coming soon</Trans>
            </Text>
          </div>
          {![SealFlow.OPEN, SealFlow.MIGRATE].includes(widgetState.flow) && (
            <Button variant="link" className="text-white" onClick={handleSkip}>
              Skip
            </Button>
          )}
        </HStack>
      </div>
      <VStack className="py-3">
        {isLoading || !lseRewardContracts ? (
          <Card>
            <Skeleton />
          </Card>
        ) : lseRewardContracts.length === 0 ? (
          <VStack gap={3} className="items-center pb-3 pt-6">
            <NoResults />
            <Text className="text-textSecondary text-center">
              <Trans>No rewards found</Trans>
            </Text>
          </VStack>
        ) : (
          lseRewardContracts?.map(({ contractAddress }) => (
            // Note: we use the staking rewards card because we're opening a stake engine position
            // but we pass the setter from the seal engine to set the value in seal context
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
