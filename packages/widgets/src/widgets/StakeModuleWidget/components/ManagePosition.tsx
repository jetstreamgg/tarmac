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
  claimPrepared,
  claimExecute,
  claimAllPrepared,
  claimAllExecute,
  batchEnabledAndSupported,
  onStakeUrnChange,
  onWidgetStateChange,
  needsAllowance,
  allowanceToken,
  batchEnabled,
  setBatchEnabled,
  isBatchTransaction,
  legalBatchTxUrl
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  currentStep: StakeStep;
  currentAction: StakeAction;
  onClickTrigger: any;
  tabSide: 'left' | 'right';
  claimPrepared: boolean;
  claimExecute: () => void;
  claimAllPrepared: boolean;
  claimAllExecute: () => void;
  batchEnabledAndSupported: boolean;
  onStakeUrnChange?: OnStakeUrnChange;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  needsAllowance: boolean;
  allowanceToken?: Token;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  isBatchTransaction: boolean;
  legalBatchTxUrl?: string;
}) => {
  return currentAction === StakeAction.OVERVIEW ? (
    <UrnsList
      claimPrepared={claimPrepared}
      claimExecute={claimExecute}
      claimAllPrepared={claimAllPrepared}
      claimAllExecute={claimAllExecute}
      batchEnabledAndSupported={batchEnabledAndSupported}
      onStakeUrnChange={onStakeUrnChange}
      onWidgetStateChange={onWidgetStateChange}
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
    />
  );
};
