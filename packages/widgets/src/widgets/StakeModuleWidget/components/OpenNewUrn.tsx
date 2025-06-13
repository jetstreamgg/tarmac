import { Text } from '@widgets/shared/components/ui/Typography';
import { getIlkName, useStakeUrnAddress, useVault } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useContext, useMemo } from 'react';
import { StakeModuleWidgetContext } from '../context/context';
import { Lock } from './Lock';
import { Borrow } from './Borrow';
import { Free } from './Free';
import { Repay } from './Repay';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { formatUrnIndex, getNextStep } from '../lib/utils';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeAction, StakeFlow, StakeStep } from '../lib/constants';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { motion } from 'framer-motion';
import { useChainId } from 'wagmi';

export const OpenNewUrn = ({
  isConnectedAndEnabled,
  onClickTrigger,
  tabSide,
  onInputAmountChange
}: {
  isConnectedAndEnabled: boolean;
  onClickTrigger: any;
  tabSide: 'left' | 'right';
  onInputAmountChange: (val: bigint, userTriggered?: boolean) => void;
}) => {
  const chainId = useChainId();
  const { widgetState } = useContext(WidgetContext);
  const {
    setSkyToLock,
    currentStep,
    setCurrentStep,
    setUsdsToBorrow,
    setUsdsToWipe,
    activeUrn,
    setSkyToFree,
    setIsLockCompleted,
    setIsBorrowCompleted
  } = useContext(StakeModuleWidgetContext);

  const { data: urnAddress } = useStakeUrnAddress(activeUrn?.urnIndex || 0n);

  const { data: vaultData } = useVault(urnAddress, getIlkName(chainId, 2));

  const showTabs = useMemo(
    () =>
      widgetState.flow === StakeFlow.MANAGE &&
      widgetState.action !== StakeAction.OVERVIEW &&
      currentStep === StakeStep.OPEN_BORROW,
    [widgetState.action, widgetState.flow, currentStep]
  );

  const clearInputs = () => {
    setSkyToLock(0n);
    setSkyToFree(0n);
    setUsdsToWipe(0n);
    setUsdsToBorrow(0n);
  };

  const handleSkip = () => {
    clearInputs();
    setIsLockCompleted(true);
    setIsBorrowCompleted(true);
    setCurrentStep(getNextStep(currentStep));
  };

  return (
    <div className="mb-4 space-y-2">
      <HStack className="items-center justify-between">
        <HStack gap={1} className="items-center">
          <div className="flex items-center">
            <Text>
              {activeUrn?.urnIndex !== undefined && activeUrn?.urnIndex >= 0n
                ? t`Manage Position ${formatUrnIndex(activeUrn?.urnIndex || 0n)}`
                : t`Open Position`}
            </Text>
          </div>
        </HStack>
        {widgetState.flow !== StakeFlow.OPEN && (
          <Button variant="link" className="text-white" onClick={handleSkip}>
            Skip
          </Button>
        )}
      </HStack>
      <Tabs value={tabSide}>
        {showTabs && (
          <motion.div variants={positionAnimations}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                position="left"
                value="left"
                onClick={() => {
                  clearInputs();
                  onClickTrigger(0);
                }}
              >
                <Trans>Stake and borrow</Trans>
              </TabsTrigger>
              <TabsTrigger
                position="right"
                value="right"
                onClick={() => {
                  clearInputs();
                  onClickTrigger(1);
                }}
              >
                <Trans>Unstake and pay back</Trans>
              </TabsTrigger>
            </TabsList>
          </motion.div>
        )}
        <TabsContent value="left">
          <VStack gap={2} className="mt-4">
            <Lock isConnectedAndEnabled={isConnectedAndEnabled} onChange={onInputAmountChange} />
            <Borrow isConnectedAndEnabled={isConnectedAndEnabled} />
          </VStack>
        </TabsContent>
        <TabsContent value="right">
          <VStack gap={2} className="mt-4">
            <Free
              isConnectedAndEnabled={isConnectedAndEnabled}
              sealedAmount={vaultData?.collateralAmount}
              onChange={onInputAmountChange}
            />
            <Repay isConnectedAndEnabled={isConnectedAndEnabled} />
          </VStack>
        </TabsContent>
      </Tabs>
    </div>
  );
};
