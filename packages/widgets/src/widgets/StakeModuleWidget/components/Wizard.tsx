import { WidgetStateChangeParams } from '@widgets/shared/types/widgetState';
import { StakeStep } from '../lib/constants';
import { getTokenDecimals, Token, TOKENS } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { OpenNewUrn } from './OpenNewUrn';
import { formatUnits } from 'viem';
import { SelectRewardContract } from './SelectRewardContract';
import { SelectDelegate } from './SelectDelegate';
import { PositionSummary } from './PositionSummary';

export const Wizard = ({
  isConnectedAndEnabled,
  onExternalLinkClicked,
  currentStep,
  onClickTrigger,
  tabSide,
  onWidgetStateChange,
  needsAllowance,
  allowanceToken,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  legalBatchTxUrl,
  onNoChangesDetected
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  currentStep: StakeStep;
  onClickTrigger: any;
  tabSide: 'left' | 'right';
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  needsAllowance: boolean;
  allowanceToken?: Token;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  legalBatchTxUrl?: string;
  onNoChangesDetected?: (hasNoChanges: boolean) => void;
}) => {
  const chainId = useChainId();
  const { widgetState, txStatus } = useContext(WidgetContext);
  return (
    <div>
      {currentStep === StakeStep.OPEN_BORROW && (
        <OpenNewUrn
          isConnectedAndEnabled={isConnectedAndEnabled}
          onClickTrigger={onClickTrigger}
          tabSide={tabSide}
          onInputAmountChange={(val: bigint, userTriggered?: boolean) => {
            if (userTriggered) {
              // If newValue is 0n and it was triggered by user, it means they're clearing the input
              const formattedValue =
                val === 0n ? '' : formatUnits(val, getTokenDecimals(TOKENS.sky, chainId));
              onWidgetStateChange?.({
                originAmount: formattedValue,
                txStatus,
                widgetState
              });
            }
          }}
        />
      )}
      {currentStep === StakeStep.REWARDS && (
        <SelectRewardContract onExternalLinkClicked={onExternalLinkClicked} />
      )}
      {currentStep === StakeStep.DELEGATE && <SelectDelegate onExternalLinkClicked={onExternalLinkClicked} />}
      {currentStep === StakeStep.SUMMARY && (
        <PositionSummary
          needsAllowance={needsAllowance}
          allowanceToken={allowanceToken}
          batchEnabled={batchEnabled}
          setBatchEnabled={setBatchEnabled}
          isBatchTransaction={isBatchTransaction}
          legalBatchTxUrl={legalBatchTxUrl}
          onNoChangesDetected={onNoChangesDetected}
        />
      )}
    </div>
  );
};
