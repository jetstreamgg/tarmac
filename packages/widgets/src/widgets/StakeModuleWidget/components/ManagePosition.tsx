import { WidgetStateChangeParams } from '@widgets/shared/types/widgetState';
import { OnStakeUrnChange } from '..';
import { StakeAction, StakeStep } from '../lib/constants';
import { Token } from '@jetstreamgg/sky-hooks';
import { UrnsList } from './UrnsList';
import { Wizard } from './Wizard';

export const ManagePosition = ({
  isConnectedAndEnabled,
  onExternalLinkClicked,
  currentStep,
  currentAction,
  onClickTrigger,
  tabSide,
  onStakeUrnChange,
  onWidgetStateChange,
  needsAllowance,
  allowanceToken,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  legalBatchTxUrl,
  disclaimer,
  onNoChangesDetected
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  currentStep: StakeStep;
  currentAction: StakeAction;
  onClickTrigger: any;
  tabSide: 'left' | 'right';
  onStakeUrnChange?: OnStakeUrnChange;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  needsAllowance: boolean;
  allowanceToken?: Token;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  legalBatchTxUrl?: string;
  disclaimer?: React.ReactNode;
  onNoChangesDetected?: (hasNoChanges: boolean) => void;
}) => {
  return currentAction === StakeAction.OVERVIEW ? (
    <UrnsList
      onStakeUrnChange={onStakeUrnChange}
      onExternalLinkClicked={onExternalLinkClicked}
      disclaimer={disclaimer}
    />
  ) : (
    <Wizard
      isConnectedAndEnabled={isConnectedAndEnabled}
      onExternalLinkClicked={onExternalLinkClicked}
      currentStep={currentStep}
      onClickTrigger={onClickTrigger}
      tabSide={tabSide}
      onWidgetStateChange={onWidgetStateChange}
      needsAllowance={needsAllowance}
      allowanceToken={allowanceToken}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      isBatchTransaction={isBatchTransaction}
      legalBatchTxUrl={legalBatchTxUrl}
      onNoChangesDetected={onNoChangesDetected}
    />
  );
};
