import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { AnimatePresence, motion } from 'framer-motion';
import { TxStatus } from '@widgets/shared/constants';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { useAccount, useChainId } from 'wagmi';
import { getStepTitle, StakeAction, StakeFlow, StakeScreen, StakeStep } from './lib/constants';
import { getNextStep, getPreviousStep, getStepIndex, getTotalSteps } from './lib/utils';
import { StepperBar } from './components/StepperBar';
import { StakeModuleWidgetContext, StakeModuleWidgetProvider } from './context/context';
import {
  useCurrentUrnIndex,
  useStakeSkyAllowance,
  useStakeUsdsAllowance,
  useStakeUrnAddress,
  useVault,
  ZERO_ADDRESS,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  TOKENS,
  getTokenDecimals,
  getIlkName,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowLeft } from 'lucide-react';
import { getValidatedState } from '@widgets/lib/utils';
import { UnconnectedState } from './components/UnconnectedState';
import { useLingui } from '@lingui/react';
import { formatUnits, parseUnits } from 'viem';
import { StakeModuleTransactionStatus } from './components/StakeModuleTransactionStatus';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { Wizard } from './components/Wizard';
import { ManagePosition } from './components/ManagePosition';
import { useStakeTransactions } from './hooks/useStakeTransactions';

export type OnStakeUrnChange = (
  urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
) => void;

type StakeModuleWidgetProps = WidgetProps & {
  onStakeUrnChange?: OnStakeUrnChange;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onShowHelpModal?: () => void;
  addRecentTransaction: any;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
};

function StakeModuleWidgetWrapped({
  rightHeaderComponent,
  onStakeUrnChange,
  externalWidgetState,
  onConnect,
  enabled = true,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  onShowHelpModal,
  addRecentTransaction,
  legalBatchTxUrl,
  referralCode,
  batchEnabled,
  setBatchEnabled
}: StakeModuleWidgetProps) {
  const validatedExternalState = getValidatedState(externalWidgetState);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    txStatus,
    widgetState,
    setWidgetState,
    setIsLoading,
    setButtonText,
    setIsDisabled,
    setTxStatus,
    setExternalLink,
    setShowStepIndicator
  } = useContext(WidgetContext);
  const { i18n } = useLingui();
  const chainId = useChainId();
  const { isConnected, isConnecting, address } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const { data: batchSupported, isLoading: isBatchSupportLoading } = useIsBatchSupported();
  const {
    isLockCompleted,
    isSelectRewardContractCompleted,
    isSelectDelegateCompleted,
    isBorrowCompleted,
    calldata,
    setCalldata,
    skyToLock,
    usdsToWipe,
    generateAllCalldata,
    currentStep,
    setCurrentStep,
    setActiveUrn,
    setSkyToLock,
    setUsdsToBorrow,
    setSelectedDelegate,
    selectedDelegate,
    setSelectedRewardContract,
    setSkyToFree,
    setUsdsToWipe,
    activeUrn,
    indexToClaim,
    setIndexToClaim,
    rewardContractToClaim,
    setRewardContractToClaim,
    wipeAll
  } = useContext(StakeModuleWidgetContext);

  const initialTabIndex = validatedExternalState?.stakeTab === StakeAction.FREE ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const tabSide = tabIndex === 0 ? 'left' : 'right';

  // Returns the urn index to use for opening a new urn
  const { data: currentUrnIndex, error: currentUrnIndexError } = useCurrentUrnIndex();

  const { data: externalParamUrnAddress } = useStakeUrnAddress(
    validatedExternalState?.urnIndex !== undefined ? BigInt(validatedExternalState.urnIndex) : -1n
  );
  const { data: externalParamVaultData } = useVault(externalParamUrnAddress || ZERO_ADDRESS, getIlkName(2));
  const { data: externalUrnRewardContract } = useStakeUrnSelectedRewardContract({
    urn: externalParamUrnAddress || ZERO_ADDRESS
  });
  const { data: externalUrnVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: externalParamUrnAddress || ZERO_ADDRESS
  });
  const { data: activeUrnVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const urnIndexForTransaction = activeUrn?.urnIndex ?? currentUrnIndex;
  const debouncedLockAmount = useDebounce(skyToLock);
  const WIPE_BUFFER_MULTIPLIER = 100005n;
  const WIPE_BUFFER_DIVISOR = 100000n;
  // Approve a 0.005% extra amount of USDS to give users a time margin to pay the debt
  // before the transaction fails due to insufficient approval
  const debouncedUsdsAmount = useDebounce(
    wipeAll && usdsToWipe ? (usdsToWipe * WIPE_BUFFER_MULTIPLIER) / WIPE_BUFFER_DIVISOR : usdsToWipe
  );

  const {
    data: stakeSkyAllowance,
    mutate: mutateStakeSkyAllowance,
    isLoading: stakeLockAllowanceLoading
  } = useStakeSkyAllowance();

  const {
    data: stakeUsdsAllowance,
    mutate: mutateStakeUsdsAllowance,
    isLoading: stakeUsdsAllowanceLoading
  } = useStakeUsdsAllowance();

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  /**
   * ACTIONS ----------------------------------------------------------------------------------
   */

  const allStepsComplete =
    isLockCompleted && isBorrowCompleted && isSelectRewardContractCompleted && isSelectDelegateCompleted;

  const { lockSkyApprove, repayUsdsApprove, multicall, batchMulticall, claimRewards } = useStakeTransactions({
    lockAmount: debouncedLockAmount,
    usdsAmount: debouncedUsdsAmount,
    stakeSkyAllowance,
    stakeUsdsAllowance,
    calldata,
    allStepsComplete,
    indexToClaim,
    setIndexToClaim,
    rewardContractToClaim,
    setRewardContractToClaim,
    mutateStakeSkyAllowance,
    mutateStakeUsdsAllowance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const shouldOpenFromWidgetButton =
    currentUrnIndex && currentUrnIndex > 0n && widgetState.action === StakeAction.OVERVIEW;

  /**
   * USEEFFECTS ----------------------------------------------------------------------------------
   */

  const needsLockAllowance = !!(stakeSkyAllowance === undefined || stakeSkyAllowance < debouncedLockAmount);
  const needsUsdsAllowance = !!(stakeUsdsAllowance === undefined || stakeUsdsAllowance < debouncedUsdsAmount);
  const shouldUseBatch = !!batchEnabled && !!batchSupported && (needsLockAllowance || needsUsdsAllowance);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  // Generate calldata when all steps are complete
  useEffect(() => {
    if (allStepsComplete && address && urnIndexForTransaction !== undefined) {
      setCalldata(generateAllCalldata(address, urnIndexForTransaction, referralCode));
    }
  }, [allStepsComplete, address, urnIndexForTransaction, generateAllCalldata, referralCode]);

  const isDelegateSkippable = selectedDelegate?.toLowerCase() === activeUrnVoteDelegate?.toLowerCase();

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Manage your position(s)`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (currentStep === StakeStep.SUMMARY) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (widgetState.action === StakeAction.APPROVE) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === StakeFlow.OPEN) {
          setButtonText(t`Confirm your position`);
        } else if (widgetState.flow === StakeFlow.MANAGE) {
          setButtonText(t`Confirm`);
        }
      } else if (shouldOpenFromWidgetButton) {
        setButtonText(t`Open a new position`);
      } else if (currentStep === StakeStep.REWARDS) {
        setButtonText(t`Confirm`);
      } else if (currentStep === StakeStep.DELEGATE) {
        if (widgetState.flow === StakeFlow.MANAGE && isDelegateSkippable) {
          setButtonText(t`Skip`);
        } else {
          setButtonText(t`Confirm`);
        }
      } else if (currentStep === StakeStep.OPEN_BORROW) {
        setButtonText(t`Confirm position`);
      } else {
        // let's set it to Next for now
        setButtonText(t`Continue`);
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    widgetState,
    txStatus,
    isConnectedAndEnabled,
    shouldOpenFromWidgetButton,
    currentStep,
    needsLockAllowance,
    needsUsdsAllowance,
    isDelegateSkippable,
    shouldUseBatch
  ]);

  // After a successful approval, wait for the next hook (multicall) to be prepared and send the transaction
  useEffect(() => {
    if (widgetState.action === StakeAction.APPROVE && txStatus === TxStatus.SUCCESS && multicall.prepared) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StakeAction.MULTICALL
      }));
      submitOnClick();
    }
  }, [widgetState.flow, widgetState.action, txStatus, multicall.prepared]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(
      isConnecting ||
        txStatus === TxStatus.LOADING ||
        txStatus === TxStatus.INITIALIZED ||
        // Keep the loading state after a successful approval as a new transaction will automatically pop up
        (widgetState.action === StakeAction.APPROVE && txStatus === TxStatus.SUCCESS)
    );
  }, [isConnecting, txStatus, widgetState.action]);

  const multicallDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) || !multicall.prepared || multicall.isLoading;

  const batchMulticallDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    !batchMulticall.prepared ||
    batchMulticall.isLoading ||
    // If the user has allowance, don't send a batch transaction as it's only 1 contract call
    (!needsLockAllowance && !needsUsdsAllowance) ||
    stakeLockAllowanceLoading ||
    stakeUsdsAllowanceLoading ||
    !batchSupported;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    (needsLockAllowance && (!lockSkyApprove.prepared || lockSkyApprove.isLoading)) ||
    (needsUsdsAllowance && (!repayUsdsApprove.prepared || repayUsdsApprove.isLoading)) ||
    (!needsLockAllowance && !needsUsdsAllowance && txStatus === TxStatus.SUCCESS && !multicall.prepared) || //disable next button if multicall is not prepared
    (!!batchEnabled && isBatchSupportLoading);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    // Enable the button if not connected so the user can connect their wallet
    if (!isConnectedAndEnabled) {
      setIsDisabled(false);
      return;
    }

    // Disable the button if the exit fee hasn't been accepted
    if (shouldOpenFromWidgetButton) {
      setIsDisabled(false);
      return;
    }

    if (widgetState.action === StakeAction.CLAIM) {
      setIsDisabled(false);
      return;
    }

    setIsDisabled(
      (currentStep === StakeStep.OPEN_BORROW && (!isLockCompleted || !isBorrowCompleted)) ||
        (currentStep === StakeStep.REWARDS && !isSelectRewardContractCompleted) ||
        (currentStep === StakeStep.DELEGATE && !isSelectDelegateCompleted) ||
        (currentStep === StakeStep.SUMMARY &&
          ((widgetState.action === StakeAction.APPROVE && approveDisabled) ||
            (txStatus !== TxStatus.SUCCESS &&
              widgetState.action === StakeAction.MULTICALL &&
              (shouldUseBatch ? batchMulticallDisabled : multicallDisabled))))
    );
  }, [
    currentStep,
    isConnectedAndEnabled,
    widgetState.flow,
    widgetState.action,
    isLockCompleted,
    isSelectRewardContractCompleted,
    isSelectDelegateCompleted,
    isBorrowCompleted,
    shouldOpenFromWidgetButton,
    multicallDisabled,
    approveDisabled,
    txStatus,
    shouldUseBatch,
    batchMulticallDisabled
  ]);

  useEffect(() => {
    //Initialize the open flow only when we are connected
    if (isConnectedAndEnabled) {
      if (currentUrnIndex === 0n) {
        // Initialize the open position flow
        setWidgetState({
          flow: StakeFlow.OPEN,
          action: StakeAction.MULTICALL, // TODO: Define if this action is ABOUT or MULTICALL based on the data
          screen: StakeScreen.ACTION
        });
      } else if (currentUrnIndex && currentUrnIndex > 0n) {
        setWidgetState(prev => ({
          flow: prev.flow || StakeFlow.MANAGE,
          action: StakeAction.OVERVIEW,
          screen: StakeScreen.ACTION
        }));
      }
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: null,
        action: null,
        screen: null
      });
      setCurrentStep(StakeStep.OPEN_BORROW);
    }
  }, [currentUrnIndex, isConnectedAndEnabled]);

  // If we need allowance and batch transactions are not supported, set the action to approve
  useEffect(() => {
    if (
      widgetState.screen === StakeScreen.ACTION &&
      (widgetState.flow === StakeFlow.OPEN || (widgetState.flow === StakeFlow.MANAGE && activeUrn))
    ) {
      if (tabSide === 'right') {
        setWidgetState((prev: WidgetState) => ({
          ...prev,
          action:
            debouncedUsdsAmount > 0n &&
            needsUsdsAllowance &&
            !stakeUsdsAllowanceLoading &&
            !shouldUseBatch &&
            !isBatchSupportLoading
              ? StakeAction.APPROVE
              : StakeAction.MULTICALL
        }));
      } else {
        setWidgetState((prev: WidgetState) => ({
          ...prev,
          action:
            debouncedLockAmount > 0n &&
            needsLockAllowance &&
            !stakeLockAllowanceLoading &&
            !shouldUseBatch &&
            !isBatchSupportLoading
              ? StakeAction.APPROVE
              : StakeAction.MULTICALL
        }));
      }
    } // else { } //For single action managements, we'll need to be more detailed here
  }, [
    debouncedUsdsAmount,
    debouncedLockAmount,
    widgetState.screen,
    widgetState.flow,
    needsUsdsAllowance,
    stakeUsdsAllowanceLoading,
    needsLockAllowance,
    stakeLockAllowanceLoading,
    activeUrn,
    tabSide,
    shouldUseBatch,
    isBatchSupportLoading
  ]);

  useEffect(() => {
    if (widgetState.flow === StakeFlow.OPEN) {
      // Reset the wizard state when we start a new open flow
      setActiveUrn(undefined, onStakeUrnChange ?? (() => {}));
      setSkyToLock(0n);
      setUsdsToBorrow(0n);
      setSelectedDelegate(undefined);
      setSelectedRewardContract(undefined);
    }
  }, [widgetState.flow]);

  useEffect(() => {
    // Scroll to top when the flow or step changes
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [widgetState.flow, currentStep]);

  const showStep = !!widgetState.action && widgetState.action !== StakeAction.OVERVIEW;

  useEffect(() => {
    if (currentUrnIndexError) {
      throw new Error('Failed to fetch current urn index');
    }
  }, [currentUrnIndexError]);

  useEffect(() => {
    // If there are no urns open, set up initial open flow
    if (currentUrnIndex === 0n) {
      setWidgetState({
        flow: StakeFlow.OPEN,
        action: StakeAction.MULTICALL,
        screen: StakeScreen.ACTION
      });
      setCurrentStep(StakeStep.OPEN_BORROW);
      return;
    }

    // Skip effect if we don't have the current urn index yet
    if (currentUrnIndex === undefined) {
      return;
    }

    // Get the current URL urn index
    const urlUrnIndex = validatedExternalState?.urnIndex;

    // If we're already in the correct state, don't do anything
    // This is key to prevent the infinite loop - if we're already showing the correct urn, do nothing
    if (activeUrn?.urnIndex === urlUrnIndex) {
      return;
    }

    // Handle navigation to root (no urn index)
    if (urlUrnIndex === undefined || urlUrnIndex === null) {
      resetToOverviewState();
      return;
    }

    // Handle navigation to specific urn
    const urnIndexBigInt = BigInt(urlUrnIndex);

    // Validate the urn index is within bounds
    if (urnIndexBigInt >= (currentUrnIndex || 0n)) {
      resetToOverviewState();
      return;
    }

    // Wait for the urn address before proceeding
    if (!externalParamUrnAddress) {
      return;
    }

    // Set up the urn state
    if (!!externalParamVaultData && externalUrnRewardContract) {
      setSelectedRewardContract(externalUrnRewardContract);
    } else {
      setSelectedRewardContract(undefined);
    }

    if (!!externalParamVaultData && externalUrnVoteDelegate) {
      setSelectedDelegate(externalUrnVoteDelegate);
    } else {
      setSelectedDelegate(undefined);
    }

    // Update widget state first
    setWidgetState({
      flow: StakeFlow.MANAGE,
      action: StakeAction.MULTICALL,
      screen: StakeScreen.ACTION
    });

    // Then update the active urn
    setActiveUrn(
      { urnAddress: externalParamUrnAddress, urnIndex: urnIndexBigInt },
      onStakeUrnChange ?? (() => {})
    );

    setCurrentStep(StakeStep.OPEN_BORROW);
  }, [
    validatedExternalState?.urnIndex,
    externalParamUrnAddress,
    currentUrnIndex,
    activeUrn?.urnIndex,
    externalParamVaultData?.collateralAmount,
    externalUrnRewardContract,
    externalUrnVoteDelegate
  ]);

  // Handle external amount
  useEffect(() => {
    if (validatedExternalState?.amount === undefined) {
      setSkyToLock(0n);
      setSkyToFree(0n);

      return;
    }

    const decimals = getTokenDecimals(TOKENS.sky, chainId);
    const amount = parseUnits(validatedExternalState.amount, decimals);

    if (tabSide === 'left') {
      setSkyToLock(amount);
      setSkyToFree(0n);
    } else {
      setSkyToFree(amount);
      setSkyToLock(0n);
    }
  }, [validatedExternalState?.amount, tabSide, chainId, widgetState.flow]);

  useEffect(() => {
    if (validatedExternalState?.flow === StakeFlow.OPEN) {
      handleClickOpenPosition();
    }
  }, [externalWidgetState?.flow]);

  /**
   * BUTTON CLICKS ----------------------------------------------------------------------------------
   */

  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setCurrentStep(getNextStep(currentStep));

    // setWidgetState((prev: WidgetState) => ({
    //   ...prev,
    //   screen: StakeScreen.ACTION
    // }));

    // TODO: Handle all states to determine the next action, this is only to test navigation in the wizard
  };

  const approveOnClick = () => {
    setShowStepIndicator(true);
    // Need to set action to approve to trigger the tx screen content
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: StakeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    if (needsLockAllowance) {
      lockSkyApprove.execute();
    } else if (needsUsdsAllowance) {
      repayUsdsApprove.execute();
    }
  };

  const onClickBack = () => {
    // TODO: This may need to handle other screens, this is for testing navigation in the wizard
    // const previousStep = getPreviousStep(widgetState.action);
    if (widgetState.screen !== StakeScreen.TRANSACTION) {
      setCurrentStep(getPreviousStep(currentStep));
    } else {
      if (widgetState.action === StakeAction.CLAIM) {
        setIndexToClaim(undefined);
        setRewardContractToClaim(undefined);
      }
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: prev.action === StakeAction.CLAIM ? StakeAction.OVERVIEW : prev.action,
        screen: StakeScreen.ACTION
      }));
    }
    setTxStatus(TxStatus.IDLE);
    // setWidgetState((prev: WidgetState) => ({
    //   ...prev,
    //   action: previousAction
    // }));
  };

  const submitOnClick = () => {
    setShowStepIndicator(true);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: StakeAction.MULTICALL,
      screen: StakeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    multicall.execute();
  };

  const batchSubmitOnClick = () => {
    setShowStepIndicator(true);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: StakeAction.MULTICALL,
      screen: StakeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    batchMulticall.execute();
  };

  const claimOnClick = () => {
    setShowStepIndicator(false);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: StakeAction.CLAIM,
      screen: StakeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    claimRewards.execute();
  };

  const finishOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState({
      flow: StakeFlow.MANAGE,
      action: StakeAction.OVERVIEW,
      screen: StakeScreen.ACTION
    });
    setActiveUrn(undefined, onStakeUrnChange ?? (() => {}));
    setCurrentStep(StakeStep.OPEN_BORROW);
    setSkyToLock(0n);
    setSkyToFree(0n);
    setUsdsToWipe(0n);
    setUsdsToBorrow(0n);
    setTabIndex(0);

    onWidgetStateChange?.({
      widgetState,
      txStatus,
      stakeTab: StakeAction.LOCK,
      originAmount: ''
    });
  };

  const handleClickOpenPosition = () => {
    // First reset urn
    setActiveUrn(undefined, onStakeUrnChange ?? (() => {}));

    setWidgetState({
      flow: StakeFlow.OPEN,
      action: StakeAction.MULTICALL,
      screen: StakeScreen.ACTION
    });
    setCurrentStep(StakeStep.OPEN_BORROW);
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? finishOnClick
      : currentStep === StakeStep.SUMMARY && widgetState.action === StakeAction.APPROVE
        ? approveOnClick
        : currentStep === StakeStep.SUMMARY && widgetState.action === StakeAction.MULTICALL
          ? shouldUseBatch
            ? batchSubmitOnClick
            : submitOnClick
          : shouldOpenFromWidgetButton
            ? handleClickOpenPosition
            : widgetState.flow === StakeFlow.MANAGE && widgetState.action === StakeAction.CLAIM
              ? claimOnClick
              : widgetState.flow === StakeFlow.OPEN || widgetState.flow === StakeFlow.MANAGE
                ? nextOnClick
                : undefined;

  const [stepIndex, totalSteps] = useMemo(
    () => [getStepIndex(currentStep, widgetState.flow) + 1, getTotalSteps(widgetState.flow)],
    [widgetState.flow, currentStep]
  );

  const showSecondaryButton = useMemo(() => {
    if (txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING) {
      return false;
    }

    if (txStatus === TxStatus.ERROR) {
      return true;
    }

    if (txStatus === TxStatus.SUCCESS) {
      return false;
    }

    return (
      (widgetState.flow === StakeFlow.OPEN && currentStep !== StakeStep.OPEN_BORROW) ||
      // TODO update for manage:
      (widgetState.flow === StakeFlow.MANAGE && currentStep !== StakeStep.OPEN_BORROW)
    );
  }, [widgetState.flow, widgetState.action, txStatus, currentStep]);

  const resetToOverviewState = () => {
    setActiveUrn(undefined, onStakeUrnChange ?? (() => {}));
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      flow: StakeFlow.MANAGE,
      action: StakeAction.OVERVIEW
    }));
    setCurrentStep(StakeStep.OPEN_BORROW);
    setSkyToLock(0n);
    setSkyToFree(0n);
    setUsdsToWipe(0n);
    setUsdsToBorrow(0n);
    setTabIndex(0);

    onWidgetStateChange?.({
      widgetState,
      txStatus,
      stakeTab: StakeAction.LOCK,
      originAmount: '',
      urnIndex: undefined
    });
  };

  const widgetStateLoaded = !!widgetState.flow && !!widgetState.action;

  const onClickTab = (index: 0 | 1) => {
    setTabIndex(index);
    onWidgetStateChange?.({
      widgetState,
      txStatus,
      stakeTab: index === 1 ? StakeAction.FREE : StakeAction.LOCK
    });
  };

  return (
    <WidgetContainer
      ref={containerRef}
      contentClassname="mt-2"
      header={
        !isConnectedAndEnabled ||
        !widgetStateLoaded ||
        (widgetState.flow === StakeFlow.OPEN && currentUrnIndex === 0n) ||
        (widgetState.flow === StakeFlow.MANAGE && widgetState.action === StakeAction.OVERVIEW) ||
        widgetState.screen === StakeScreen.TRANSACTION ? (
          <VStack className="w-full">
            <Heading variant="x-large">
              <Trans>Staking Engine</Trans>
            </Heading>
          </VStack>
        ) : (
          // do we want to wrap this? <CardAnimationWrapper key="widget-back-button"></CardAnimationWrapper>
          <VStack className="w-full">
            <Button variant="link" onClick={resetToOverviewState} className="justify-start p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  View all positions
                </Heading>
              </HStack>
            </Button>
          </VStack>
        )
      }
      subHeader={
        !isConnectedAndEnabled ||
        !widgetStateLoaded ||
        (widgetState.flow === StakeFlow.OPEN && currentUrnIndex === 0n) ||
        (widgetState.flow === StakeFlow.MANAGE && widgetState.action === StakeAction.OVERVIEW) ||
        widgetState.screen === StakeScreen.TRANSACTION ? (
          <Text className="text-textSecondary" variant="small">
            <Trans>Stake SKY to earn rewards, delegate votes, and borrow USDS</Trans>
          </Text>
        ) : undefined
      }
      rightHeader={rightHeaderComponent}
      footer={
        <WidgetButtons
          enabled={enabled}
          onClickAction={onClickAction}
          onClickBack={onClickBack}
          showSecondaryButton={showSecondaryButton}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!isConnectedAndEnabled ? (
          <UnconnectedState
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
            onShowHelpModal={onShowHelpModal}
          />
        ) : txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <StakeModuleTransactionStatus
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsLockAllowance || needsUsdsAllowance}
            />
          </CardAnimationWrapper>
        ) : (
          <div>
            {showStep && (
              <motion.div className="py-6 pr-3" exit={{ opacity: 0, transition: { duration: 0 } }}>
                <StepperBar
                  step={stepIndex}
                  totalSteps={totalSteps}
                  title={i18n._(getStepTitle(currentStep, tabSide))}
                  onShowHelpModal={onShowHelpModal}
                />
              </motion.div>
            )}
            <CardAnimationWrapper key="widget-inputs" className="w-full">
              <VStack className="w-full">
                <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
                  {widgetState.flow === StakeFlow.MANAGE && (
                    <ManagePosition
                      isConnectedAndEnabled={isConnectedAndEnabled}
                      onExternalLinkClicked={onExternalLinkClicked}
                      currentStep={currentStep}
                      currentAction={widgetState.action}
                      onClickTrigger={onClickTab}
                      tabSide={tabSide}
                      claimPrepared={claimRewards.prepared}
                      claimExecute={claimRewards.execute}
                      onStakeUrnChange={onStakeUrnChange}
                      onWidgetStateChange={onWidgetStateChange}
                      needsAllowance={needsLockAllowance || needsUsdsAllowance}
                      allowanceToken={
                        needsLockAllowance ? TOKENS.sky : needsUsdsAllowance ? TOKENS.usds : undefined
                      }
                      batchEnabled={batchEnabled}
                      setBatchEnabled={setBatchEnabled}
                      isBatchTransaction={shouldUseBatch}
                      legalBatchTxUrl={legalBatchTxUrl}
                    />
                  )}
                  {widgetState.flow === StakeFlow.OPEN && (
                    <Wizard
                      isConnectedAndEnabled={isConnectedAndEnabled}
                      onExternalLinkClicked={onExternalLinkClicked}
                      currentStep={currentStep}
                      onClickTrigger={onClickTab}
                      tabSide={tabSide}
                      onWidgetStateChange={onWidgetStateChange}
                      needsAllowance={needsLockAllowance}
                      allowanceToken={needsLockAllowance ? TOKENS.sky : undefined}
                      batchEnabled={batchEnabled}
                      setBatchEnabled={setBatchEnabled}
                      isBatchTransaction={shouldUseBatch}
                      legalBatchTxUrl={legalBatchTxUrl}
                    />
                  )}
                </MotionVStack>
              </VStack>
            </CardAnimationWrapper>
          </div>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
}

const StakeModuleWidgetWithProvider = (props: StakeModuleWidgetProps) => (
  <StakeModuleWidgetProvider>
    <StakeModuleWidgetWrapped {...props} />
  </StakeModuleWidgetProvider>
);

export const StakeModuleWidget = withWidgetProvider(StakeModuleWidgetWithProvider, 'StakeModuleWidget');
