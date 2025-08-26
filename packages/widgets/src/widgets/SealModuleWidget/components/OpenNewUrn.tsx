import { Checkbox } from '@widgets/components/ui/checkbox';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useUrnAddress, useVault } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useContext } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import { About } from './About';
import { Free } from './Free';
import { Repay } from './Repay';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { formatUrnIndex, getNextStep } from '../lib/utils';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { SealFlow, SealStep } from '../lib/constants';

export const OpenNewUrn = ({
  isConnectedAndEnabled,
  onExternalLinkClicked,
  termsLink,
  onInputAmountChange
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  termsLink?: { url: string; name: string };
  onInputAmountChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  const { acceptedExitFee, setAcceptedExitFee } = useContext(SealModuleWidgetContext);
  const { widgetState } = useContext(WidgetContext);
  const {
    currentStep,
    setCurrentStep,
    setUsdsToWipe,
    activeUrn,
    setMkrToFree,
    setIsLockCompleted,
    setIsBorrowCompleted
  } = useContext(SealModuleWidgetContext);

  const { data: urnAddress } = useUrnAddress(activeUrn?.urnIndex || 0n);

  const { data: vaultData } = useVault(urnAddress);

  const clearInputs = () => {
    setMkrToFree(0n);
    setUsdsToWipe(0n);
  };

  const handleSkip = () => {
    clearInputs();
    setIsLockCompleted(true);
    setIsBorrowCompleted(true);
    setCurrentStep(getNextStep(currentStep));
  };

  return (
    <div className="mb-4 space-y-2">
      {currentStep === SealStep.ABOUT ? (
        <About />
      ) : (
        <>
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
            {widgetState.flow !== SealFlow.OPEN && (
              <Button variant="link" className="text-white" onClick={handleSkip}>
                Skip
              </Button>
            )}
          </HStack>
          <VStack gap={2} className="mt-4">
            <Free
              isConnectedAndEnabled={isConnectedAndEnabled}
              sealedAmount={vaultData?.collateralAmount}
              onChange={onInputAmountChange}
            />
            <Repay isConnectedAndEnabled={isConnectedAndEnabled} />
          </VStack>
        </>
      )}
      {widgetState.flow !== SealFlow.MANAGE && currentStep === SealStep.ABOUT && (
        <div>
          <div className="flex gap-2">
            <Checkbox
              checked={acceptedExitFee}
              onCheckedChange={(checked: boolean) => {
                setAcceptedExitFee(checked === true);
              }}
            />
            <div className="cursor-pointer" onClick={() => setAcceptedExitFee(!acceptedExitFee)}>
              <Text variant="medium">
                {t`I have read and understand the`}{' '}
                {termsLink ? (
                  <ExternalLink
                    href={termsLink.url}
                    showIcon={false}
                    className="text-textEmphasis"
                    onExternalLinkClicked={onExternalLinkClicked}
                  >
                    {termsLink.name}.
                  </ExternalLink>
                ) : (
                  <Trans>Terms of Use.</Trans>
                )}
              </Text>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
