import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { WidgetContext, WidgetProvider } from '@widgets/context/WidgetContext';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
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
import { useConnection, useChainId } from 'wagmi';
import { getStepTitle, SealAction, SealFlow, SealScreen, SealStep } from './lib/constants';
import { getNextStep, getPreviousStep, getStepIndex, getTotalSteps } from './lib/utils';
import { StepperBar } from './components/StepperBar';
import { UrnsList } from './components/UrnsList';
import { OpenNewUrn } from './components/OpenNewUrn';
import { SelectRewardContract } from './components/SelectRewardContract';
import { SealModuleWidgetContext, SealModuleWidgetProvider } from './context/context';
import { SelectDelegate } from './components/SelectDelegate';
import { PositionSummary } from './components/PositionSummary';
import {
  useSealCurrentIndex,
  useSaNgtAllowance,
  useSaNstAllowance as useSealUsdsAllowance,
  useSaNstApprove as useSealUsdsApprove,
  useSaMulticall,
  useClaimRewards,
  useUrnAddress,
  useVault,
  ZERO_ADDRESS,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, getTransactionLink, useDebounce, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { SealModuleTransactionStatus } from './components/SealModuleTransactionStatus';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowLeft } from 'lucide-react';
import { UnconnectedState } from './components/UnconnectedState';
import { useLingui } from '@lingui/react';
import { OnSealUrnChange } from './lib/types';

type SealModuleWidgetProps = WidgetProps & {
  onSealUrnChange?: OnSealUrnChange;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onNavigateToStakeWidget?: () => void;
  addRecentTransaction: any;
  termsLink?: { url: string; name: string };
  mkrSkyUpgradeUrl?: string;
};

export const SealModuleWidget = ({
  locale,
  rightHeaderComponent,
  onSealUrnChange,
  externalWidgetState,
  onConnect,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  onNavigateToStakeWidget,
  addRecentTransaction,
  termsLink,
  referralCode,
  mkrSkyUpgradeUrl
}: SealModuleWidgetProps) => {
  return (
    <ErrorBoundary componentName="SealModuleWidget">
      <WidgetProvider locale={locale}>
        <SealModuleWidgetProvider>
          <SealModuleWidgetWrapped
            rightHeaderComponent={rightHeaderComponent}
            onSealUrnChange={onSealUrnChange}
            externalWidgetState={externalWidgetState}
            onConnect={onConnect}
            onNotification={onNotification}
            onWidgetStateChange={onWidgetStateChange}
            onExternalLinkClicked={onExternalLinkClicked}
            addRecentTransaction={addRecentTransaction}
            termsLink={termsLink}
            referralCode={referralCode}
            onNavigateToStakeWidget={onNavigateToStakeWidget}
            mkrSkyUpgradeUrl={mkrSkyUpgradeUrl}
          />
        </SealModuleWidgetProvider>
      </WidgetProvider>
    </ErrorBoundary>
  );
};

function SealModuleWidgetWrapped({
  rightHeaderComponent,
  onSealUrnChange,
  externalWidgetState,
  onConnect,
  enabled = true,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  addRecentTransaction,
  termsLink,
  referralCode,
  onNavigateToStakeWidget,
  mkrSkyUpgradeUrl
}: SealModuleWidgetProps) {
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
    setShowStepIndicator,
    setBackButtonText
  } = useContext(WidgetContext);

  const { i18n } = useLingui();
  const chainId = useChainId();
  const { isConnected, isConnecting, address } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const {
    acceptedExitFee,
    acceptedMkrUpgrade,
    isLockCompleted,
    isSelectRewardContractCompleted,
    isSelectDelegateCompleted,
    isBorrowCompleted,
    calldata,
    setCalldata,
    usdsToWipe,
    mkrToFree, // eslint-disable-line @typescript-eslint/no-unused-vars
    generateAllCalldata,
    currentStep,
    setCurrentStep,
    setActiveUrn,
    setSelectedDelegate,
    setSelectedRewardContract,
    setAcceptedExitFee,
    setMkrToFree,
    setUsdsToWipe,
    activeUrn,
    indexToClaim,
    setIndexToClaim,
    rewardContractToClaim,
    setRewardContractToClaim,
    wipeAll
  } = useContext(SealModuleWidgetContext);

  // Returns the urn index to use for opening a new urn
  const { data: currentUrnIndex } = useSealCurrentIndex();

  const { data: externalParamUrnAddress } = useUrnAddress(
    externalWidgetState?.urnIndex !== undefined ? BigInt(externalWidgetState.urnIndex) : -1n
  );
  const { data: externalParamVaultData } = useVault(externalParamUrnAddress || ZERO_ADDRESS);
  const { data: externalUrnRewardContract } = useUrnSelectedRewardContract({
    urn: externalParamUrnAddress || ZERO_ADDRESS
  });
  const { data: externalUrnVoteDelegate } = useUrnSelectedVoteDelegate({
    urn: externalParamUrnAddress || ZERO_ADDRESS
  });

  const urnIndexForTransaction = activeUrn?.urnIndex ?? currentUrnIndex;

  const WIPE_BUFFER_MULTIPLIER = 100005n;
  const WIPE_BUFFER_DIVISOR = 100000n;
  // Approve a 0.005% extra amount of USDS to give users a time margin to pay the debt
  // before the transaction fails due to insufficient approval
  const debouncedUsdsAmount = useDebounce(
    wipeAll && usdsToWipe ? (usdsToWipe * WIPE_BUFFER_MULTIPLIER) / WIPE_BUFFER_DIVISOR : usdsToWipe
  );

  const { mutate: mutateSealNgtAllowance } = useSaNgtAllowance();

  const {
    data: sealUsdsAllowance,
    mutate: mutateSealUsdsAllowance,
    isLoading: sealUsdsAllowanceLoading
  } = useSealUsdsAllowance();

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  /**
   * ACTIONS ----------------------------------------------------------------------------------
   */

  const allStepsComplete =
    isLockCompleted && isBorrowCompleted && isSelectRewardContractCompleted && isSelectDelegateCompleted;

  const repayUsdsApprove = useSealUsdsApprove({
    amount: debouncedUsdsAmount,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedUsdsAmount)} USDS`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved USDS`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateSealUsdsAllowance();
      multicall.retryPrepare();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Approval failed`,
        description: t`We could not approve your token allowance.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateSealUsdsAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    enabled: widgetState.action === SealAction.APPROVE && sealUsdsAllowance !== undefined
  });

  const multicall = useSaMulticall({
    calldata,
    enabled: widgetState.action === SealAction.MULTICALL && !!allStepsComplete,
    onStart: (hash: string) => {
      addRecentTransaction?.({ hash, description: t`Doing multicall` });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`The multicall transaction was successful`,
        description: t`The transaction was successful.`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      // TODO Mutate balances here
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Multicall failed`,
        description: t`We could not complete the transaction.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const claimRewards = useClaimRewards({
    index: indexToClaim,
    rewardContract: rewardContractToClaim,
    to: address,
    enabled: indexToClaim !== undefined && !!rewardContractToClaim && !!address,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: 'Claiming rewards'
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (hash: string) => {
      //TODO: Update copy
      onNotification?.({
        title: t`Claim successful`,
        description: t`You claimed your rewards`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      // TODO: `useRewardsRewardsBalance` invalidates the query after every block,
      // do we need to invalidate it again here?
      // mutateRewardsBalance();
      setIndexToClaim(undefined);
      setRewardContractToClaim(undefined);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error: Error, hash: string) => {
      //TODO: Update copy
      onNotification?.({
        title: t`Claim failed`,
        description: t`We could not claim your rewards.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const shouldOpenFromWidgetButton =
    currentUrnIndex && currentUrnIndex > 0n && widgetState.action === SealAction.OVERVIEW;

  /**
   * USEEFFECTS ----------------------------------------------------------------------------------
   */

  const needsUsdsAllowance = !!(sealUsdsAllowance === undefined || sealUsdsAllowance < debouncedUsdsAmount);

  // Generate calldata when all steps are complete
  useEffect(() => {
    if (allStepsComplete && address && urnIndexForTransaction !== undefined) {
      const cd = generateAllCalldata(address, urnIndexForTransaction, referralCode);
      setCalldata(cd);
    }
  }, [allStepsComplete, address, generateAllCalldata, referralCode, widgetState?.flow, chainId]);

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (widgetState.action === SealAction.APPROVE && txStatus === TxStatus.SUCCESS && !needsUsdsAllowance) {
        setButtonText(t`Continue`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (
        widgetState.action === SealAction.APPROVE &&
        currentStep === SealStep.SUMMARY &&
        needsUsdsAllowance
      ) {
        setButtonText(t`Approve repay amount`);
      } else if (widgetState.flow === SealFlow.OPEN && currentStep === SealStep.SUMMARY) {
        setButtonText(t`Confirm your position`);
      } else if (widgetState.flow === SealFlow.MANAGE && currentStep === SealStep.SUMMARY) {
        setButtonText(t`Confirm`);
      } else if (shouldOpenFromWidgetButton) {
        setButtonText(t`New positions disabled`);
      } else if ([SealStep.REWARDS, SealStep.DELEGATE].includes(currentStep)) {
        setButtonText(t`Confirm`);
      } else if (currentStep === SealStep.OPEN_BORROW) {
        setButtonText(t`Confirm position`);
      } else if (widgetState.flow === SealFlow.MANAGE && currentStep === SealStep.ABOUT) {
        setButtonText(t`New positions disabled`);
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
    needsUsdsAllowance
  ]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus]);

  const multicallDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) || !multicall.prepared || multicall.isLoading;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    (needsUsdsAllowance && (!repayUsdsApprove.prepared || repayUsdsApprove.isLoading)) ||
    (!needsUsdsAllowance && txStatus === TxStatus.SUCCESS && !multicall.prepared); //disable next button if multicall is not prepared

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    // Enable the button if not connected so the user can connect their wallet
    if (!isConnectedAndEnabled) {
      setIsDisabled(false);
      return;
    }

    // Always disable the button for opening new positions
    // New positions are disabled as Seal is deprecated
    if (widgetState.action === SealAction.OVERVIEW) {
      setIsDisabled(true);
      return;
    }

    // Disable the button if the exit fee hasn't been accepted
    if (shouldOpenFromWidgetButton) {
      setIsDisabled(false);
      return;
    }

    if (widgetState.action === SealAction.CLAIM) {
      setIsDisabled(false);
      return;
    }

    setIsDisabled(
      (currentStep === SealStep.OPEN_BORROW && (!isLockCompleted || !isBorrowCompleted)) ||
        (currentStep === SealStep.REWARDS && !isSelectRewardContractCompleted) ||
        (currentStep === SealStep.DELEGATE && !isSelectDelegateCompleted) ||
        (currentStep === SealStep.SUMMARY &&
          ((widgetState.action === SealAction.APPROVE && approveDisabled) ||
            (txStatus !== TxStatus.SUCCESS &&
              widgetState.action === SealAction.MULTICALL &&
              multicallDisabled)))
    );
  }, [
    currentStep,
    acceptedMkrUpgrade,
    isConnectedAndEnabled,
    widgetState.flow,
    widgetState.action,
    isLockCompleted,
    isSelectRewardContractCompleted,
    isSelectDelegateCompleted,
    isBorrowCompleted,
    shouldOpenFromWidgetButton,
    acceptedExitFee,
    multicallDisabled,
    approveDisabled,
    txStatus
  ]);

  useEffect(() => {
    //Initialize the open flow only when we are connected
    if (isConnectedAndEnabled) {
      if (currentUrnIndex === 0n) {
        // Initialize the open position flow
        setWidgetState({
          flow: SealFlow.OPEN,
          action: SealAction.MULTICALL, // TODO: Define if this action is ABOUT or MULTICALL based on the data
          screen: SealScreen.ACTION
        });
      } else if (currentUrnIndex && currentUrnIndex > 0n) {
        setWidgetState({
          flow: SealFlow.MANAGE,
          action: SealAction.OVERVIEW,
          screen: SealScreen.ACTION
        });
      }
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: null,
        action: null,
        screen: null
      });
      setCurrentStep(SealStep.ABOUT);
    }
  }, [currentUrnIndex, isConnectedAndEnabled]);

  // If we need allowance, set the action to approve,
  useEffect(() => {
    if (
      widgetState.screen === SealScreen.ACTION &&
      (widgetState.flow === SealFlow.OPEN || (widgetState.flow === SealFlow.MANAGE && activeUrn))
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action:
          debouncedUsdsAmount > 0n && needsUsdsAllowance && !sealUsdsAllowanceLoading
            ? SealAction.APPROVE
            : SealAction.MULTICALL
      }));
    }
  }, [
    debouncedUsdsAmount,
    widgetState.screen,
    widgetState.flow,
    needsUsdsAllowance,
    sealUsdsAllowanceLoading,
    activeUrn
  ]);

  useEffect(() => {
    if (widgetState.flow === SealFlow.OPEN) {
      // Reset the wizard state when we start a new open flow
      setActiveUrn(undefined, onSealUrnChange ?? (() => {}));
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

  const showStep =
    !!widgetState.action && widgetState.action !== SealAction.OVERVIEW && currentStep !== SealStep.ABOUT;

  useEffect(() => {
    if (
      externalWidgetState?.urnIndex !== undefined &&
      externalWidgetState.urnIndex !== null &&
      !!externalParamUrnAddress
    ) {
      // Navigate to the Urn
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
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: SealAction.MULTICALL
      }));
      setActiveUrn(
        { urnAddress: externalParamUrnAddress, urnIndex: BigInt(externalWidgetState.urnIndex) },
        onSealUrnChange ?? (() => {})
      );
      setCurrentStep(SealStep.OPEN_BORROW);
      setAcceptedExitFee(false);
    }
  }, [externalWidgetState?.urnIndex, externalParamUrnAddress]);

  // Handle network changes
  useEffect(() => {
    // Reset widget state when network changes
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    // Reset all state variables
    setMkrToFree(0n);
    setUsdsToWipe(0n);
    setAcceptedExitFee(false);

    // Reset claim-related state
    setIndexToClaim(undefined);
    setRewardContractToClaim(undefined);

    // Reset to initial widget state
    if (isConnectedAndEnabled) {
      if (currentUrnIndex === 0n) {
        // Initialize the open position flow
        setWidgetState({
          flow: SealFlow.OPEN,
          action: SealAction.MULTICALL,
          screen: SealScreen.ACTION
        });
      } else if (currentUrnIndex && currentUrnIndex > 0n) {
        setWidgetState({
          flow: SealFlow.MANAGE,
          action: SealAction.OVERVIEW,
          screen: SealScreen.ACTION
        });
      }
    } else {
      setWidgetState({
        flow: null,
        action: null,
        screen: null
      });
    }

    // Reset current step
    setCurrentStep(SealStep.ABOUT);

    // Reset active URN
    setActiveUrn(undefined, onSealUrnChange ?? (() => {}));

    // Refresh allowances
    mutateSealNgtAllowance();
    mutateSealUsdsAllowance();
  }, [chainId]);

  /**
   * BUTTON CLICKS ----------------------------------------------------------------------------------
   */

  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setCurrentStep(getNextStep(currentStep, widgetState.flow));
    // TODO: Handle all states to determine the next action, this is only to test navigation in the wizard
  };

  const approveOnClick = () => {
    setShowStepIndicator(true);
    // Need to set action to approve to trigger the tx screen content
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: SealScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    if (needsUsdsAllowance) {
      repayUsdsApprove.execute();
    }
  };

  const onClickBack = () => {
    // TODO: This may need to handle other screens, this is for testing navigation in the wizard
    // const previousStep = getPreviousStep(widgetState.action);
    if (widgetState.screen !== SealScreen.TRANSACTION) {
      setCurrentStep(getPreviousStep(currentStep, widgetState.flow));
    } else {
      if (widgetState.action === SealAction.CLAIM) {
        setIndexToClaim(undefined);
        setRewardContractToClaim(undefined);
      }
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: prev.action === SealAction.CLAIM ? SealAction.OVERVIEW : prev.action,
        screen: SealScreen.ACTION
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
      action: SealAction.MULTICALL,
      screen: SealScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    multicall.execute();
  };

  const claimOnClick = () => {
    setShowStepIndicator(false);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: SealAction.CLAIM,
      screen: SealScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    claimRewards.execute();
  };

  const finishOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState({
      flow: SealFlow.MANAGE,
      action: SealAction.OVERVIEW,
      screen: SealScreen.ACTION
    });
    setActiveUrn(undefined, onSealUrnChange ?? (() => {}));
    setCurrentStep(SealStep.ABOUT);
    setAcceptedExitFee(false);
    setMkrToFree(0n);
    setUsdsToWipe(0n);
  };

  const handleClickOpenPosition = () => {
    setWidgetState({
      flow: SealFlow.OPEN,
      action: SealAction.MULTICALL,
      screen: SealScreen.ACTION
    });
    setCurrentStep(SealStep.ABOUT);
    setAcceptedExitFee(false);
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : currentStep === SealStep.SUMMARY &&
        widgetState.action === SealAction.APPROVE &&
        txStatus === TxStatus.SUCCESS &&
        !needsUsdsAllowance
      ? submitOnClick
      : txStatus === TxStatus.SUCCESS
        ? finishOnClick
        : currentStep === SealStep.SUMMARY && widgetState.action === SealAction.APPROVE
          ? approveOnClick
          : currentStep === SealStep.SUMMARY && widgetState.action === SealAction.MULTICALL
            ? submitOnClick
            : shouldOpenFromWidgetButton
              ? handleClickOpenPosition
              : widgetState.flow === SealFlow.MANAGE && widgetState.action === SealAction.CLAIM
                ? claimOnClick
                : widgetState.flow === SealFlow.OPEN || widgetState.flow === SealFlow.MANAGE
                  ? nextOnClick
                  : undefined;

  const [stepIndex, totalSteps] = useMemo(
    () => [getStepIndex(currentStep, widgetState.flow) + 1, getTotalSteps(widgetState.flow)],
    [widgetState.flow, currentStep]
  );

  // TODO make sure to show the secondary button after approval, but before continuing to multicall
  const showSecondaryButton = useMemo(() => {
    if (txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING) {
      return false;
    }

    if (txStatus === TxStatus.ERROR) {
      return true;
    }

    if (txStatus === TxStatus.SUCCESS && widgetState.action !== SealAction.APPROVE) {
      return false;
    }

    return (
      (widgetState.flow === SealFlow.OPEN && currentStep !== SealStep.ABOUT) ||
      // TODO update for manage:
      (widgetState.flow === SealFlow.MANAGE &&
        currentStep !== SealStep.OPEN_BORROW &&
        currentStep !== SealStep.ABOUT)
    );
  }, [widgetState.flow, widgetState.action, txStatus, currentStep]);

  const handleViewAll = () => {
    setActiveUrn(undefined, onSealUrnChange ?? (() => {}));
    onSealUrnChange?.(undefined);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      flow: SealFlow.MANAGE,
      action: SealAction.OVERVIEW
    }));
    setCurrentStep(SealStep.ABOUT);
    setMkrToFree(0n);
    setUsdsToWipe(0n);
    setBackButtonText(t`Back`);
  };

  const widgetStateLoaded = !!widgetState.flow && !!widgetState.action;

  return (
    <WidgetContainer
      ref={containerRef}
      containerClassName="h-[calc(100%-40px)]"
      contentClassname="mt-2"
      header={
        !widgetStateLoaded ||
        (widgetState.flow === SealFlow.OPEN && currentUrnIndex === 0n) ||
        (widgetState.flow === SealFlow.MANAGE && widgetState.action === SealAction.OVERVIEW) ||
        widgetState.screen === SealScreen.TRANSACTION ? (
          <VStack className="w-full">
            <Heading variant="x-large">
              <Trans>Seal Engine</Trans>
            </Heading>
          </VStack>
        ) : (
          // do we want to wrap this? <CardAnimationWrapper key="widget-back-button"></CardAnimationWrapper>
          <VStack className="w-full">
            <Button variant="link" onClick={handleViewAll} className="justify-start p-0">
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
        {!isConnectedAndEnabled && <UnconnectedState />}
        {txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <SealModuleTransactionStatus onExternalLinkClicked={onExternalLinkClicked} />
          </CardAnimationWrapper>
        ) : (
          <div>
            {showStep && (
              <motion.div className="py-6" exit={{ opacity: 0, transition: { duration: 0 } }}>
                <StepperBar
                  step={stepIndex}
                  totalSteps={totalSteps}
                  title={i18n._(getStepTitle(currentStep, 'right'))}
                />
              </motion.div>
            )}
            <CardAnimationWrapper key="widget-inputs" className="w-full">
              <VStack className="w-full">
                <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
                  {widgetState.flow === SealFlow.MANAGE && (
                    <ManagePosition
                      isConnectedAndEnabled={isConnectedAndEnabled}
                      onExternalLinkClicked={onExternalLinkClicked}
                      currentStep={currentStep}
                      currentAction={widgetState.action}
                      claimPrepared={claimRewards.prepared}
                      claimExecute={claimRewards.execute}
                      onSealUrnChange={onSealUrnChange}
                      termsLink={termsLink}
                      onNavigateToStakeWidget={onNavigateToStakeWidget}
                      mkrSkyUpgradeUrl={mkrSkyUpgradeUrl}
                    />
                  )}
                  {widgetState.flow === SealFlow.OPEN && (
                    <Wizard
                      isConnectedAndEnabled={isConnectedAndEnabled}
                      onExternalLinkClicked={onExternalLinkClicked}
                      currentStep={currentStep}
                      termsLink={termsLink}
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

const Wizard = ({
  isConnectedAndEnabled,
  onExternalLinkClicked,
  currentStep,
  termsLink
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  currentStep: SealStep;
  termsLink?: { url: string; name: string };
}) => {
  return (
    <div>
      {currentStep === SealStep.ABOUT && (
        <Text>
          Creation of new positions has been disabled. Management of existing positions remains available.
        </Text>
      )}
      {currentStep === SealStep.OPEN_BORROW && (
        <OpenNewUrn
          isConnectedAndEnabled={isConnectedAndEnabled}
          onExternalLinkClicked={onExternalLinkClicked}
          termsLink={termsLink}
        />
      )}
      {currentStep === SealStep.REWARDS && (
        <SelectRewardContract onExternalLinkClicked={onExternalLinkClicked} />
      )}
      {currentStep === SealStep.DELEGATE && <SelectDelegate onExternalLinkClicked={onExternalLinkClicked} />}
      {currentStep === SealStep.SUMMARY && <PositionSummary />}
    </div>
  );
};

const ManagePosition = ({
  isConnectedAndEnabled,
  onExternalLinkClicked,
  currentStep,
  currentAction,
  claimPrepared,
  claimExecute,
  onSealUrnChange,
  termsLink,
  onNavigateToStakeWidget,
  mkrSkyUpgradeUrl
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  currentStep: SealStep;
  currentAction: SealAction;
  claimPrepared: boolean;
  mkrSkyUpgradeUrl?: string;
  claimExecute: () => void;
  onSealUrnChange?: OnSealUrnChange;
  termsLink?: { url: string; name: string };
  onNavigateToStakeWidget?: () => void;
}) => {
  return currentAction === SealAction.OVERVIEW ? (
    <UrnsList
      claimPrepared={claimPrepared}
      claimExecute={claimExecute}
      onSealUrnChange={onSealUrnChange}
      onNavigateToStakeWidget={onNavigateToStakeWidget}
      onExternalLinkClicked={onExternalLinkClicked}
      mkrSkyUpgradeUrl={mkrSkyUpgradeUrl}
    />
  ) : (
    <Wizard
      isConnectedAndEnabled={isConnectedAndEnabled}
      onExternalLinkClicked={onExternalLinkClicked}
      currentStep={currentStep}
      termsLink={termsLink}
    />
  );
};
