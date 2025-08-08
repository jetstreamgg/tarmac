import {
  getTokenDecimals,
  TOKENS,
  useStUsdsAllowance,
  useStUsdsApprove,
  useStUsdsData,
  useStUsdsDeposit,
  useStUsdsWithdraw,
  useStUsdsCapacityData,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { getTransactionLink, useDebounce, formatBigInt, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { StUSDSFlow, StUSDSAction, StUSDSScreen } from './lib/constants';
import { StUSDSTransactionStatus } from './components/StUSDSTransactionStatus';
import { StUSDSSupplyWithdraw } from './components/StUSDSSupplyWithdraw';
import { WidgetContext, WidgetProvider } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@widgets/components/ui/button';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { StUSDSTransactionReview } from './components/StUSDSTransactionReview';

export type StUSDSWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  onBackToExpert?: () => void;
};

export const StUSDSWidget = ({
  onConnect,
  addRecentTransaction,
  locale,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  referralCode,
  shouldReset = false,
  batchEnabled,
  setBatchEnabled,
  onBackToExpert
}: StUSDSWidgetProps) => {
  const key = shouldReset ? 'reset' : undefined;
  return (
    <ErrorBoundary componentName="StUSDSWidget">
      <WidgetProvider key={key} locale={locale}>
        <StUSDSWidgetWrapped
          key={key}
          onConnect={onConnect}
          addRecentTransaction={addRecentTransaction}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={shouldReset ? undefined : onWidgetStateChange}
          onExternalLinkClicked={onExternalLinkClicked}
          enabled={enabled}
          referralCode={referralCode}
          batchEnabled={batchEnabled}
          setBatchEnabled={setBatchEnabled}
          onBackToExpert={onBackToExpert}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
};

// HOC Widget
const StUSDSWidgetWrapped = ({
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  referralCode,
  batchEnabled,
  setBatchEnabled,
  onBackToExpert
}: StUSDSWidgetProps) => {
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useAccount();
  const isSafeWallet = useIsSafeWallet();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const { mutate: mutateStUsds, data: stUsdsData, isLoading: isStUsdsDataLoading } = useStUsdsData();
  const { data: capacityData } = useStUsdsCapacityData();
  const { data: allowance, mutate: mutateAllowance, isLoading: allowanceLoading } = useStUsdsAllowance();
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, 18)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === StUSDSFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [max, setMax] = useState<boolean>(false);
  const linguiCtx = useLingui();
  const usds = TOKENS.usds;
  const { data: batchSupported, isLoading: isBatchSupportLoading } = useIsBatchSupported();

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    txStatus,
    setTxStatus,
    setExternalLink,
    widgetState,
    setWidgetState,
    setShowStepIndicator
  } = useContext(WidgetContext);

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  const stUsdsApprove = useStUsdsApprove({
    amount: debouncedAmount,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedAmount)} USDS`
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
      mutateAllowance();
      stUsdsDeposit.retryPrepare();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Approval failed`,
        description: t`We could not approve your token allowance.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    enabled: widgetState.action === StUSDSAction.APPROVE && allowance !== undefined
  });

  const savingsSupplyParams = {
    amount: debouncedAmount,
    onStart: (hash?: string) => {
      if (hash) {
        addRecentTransaction?.({
          hash,
          description: t`Supplying ${formatBigInt(debouncedAmount)} USDS`
        });
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (hash: string | undefined) => {
      onNotification?.({
        title: t`Supply successful`,
        description: t`You supplied ${formatBigInt(debouncedAmount)} USDS`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      mutateAllowance();
      mutateStUsds();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error: Error, hash: string | undefined) => {
      onNotification?.({
        title: t`Supply failed`,
        description: t`Something went wrong with your transaction. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      mutateAllowance();
      mutateStUsds();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    referral: referralCode
  };

  const stUsdsDeposit = useStUsdsDeposit({
    ...savingsSupplyParams,
    enabled: widgetState.action === StUSDSAction.SUPPLY && allowance !== undefined
  });

  // TODO: Implement batch support later
  const batchSavingsSupply = { prepared: false, isLoading: false, execute: () => {} };

  const stUsdsWithdraw = useStUsdsWithdraw({
    amount: debouncedAmount,
    max,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Withdrawing ${formatBigInt(debouncedAmount)} USDS`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Withdraw successful`,
        description: t`You withdrew ${formatBigInt(debouncedAmount)} USDS`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateStUsds();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Withdraw failed`,
        description: t`Something went wrong with your withdraw. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateAllowance();
      mutateStUsds();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    enabled: widgetState.action === StUSDSAction.WITHDRAW
  });

  const needsAllowance = !!(!allowance || allowance < debouncedAmount);
  // Temporarily disable batch operations until useStUsdsBatchDeposit is implemented
  const shouldUseBatch = false;
  // const shouldUseBatch =
  //   !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === StUSDSFlow.SUPPLY;

  useEffect(() => {
    //Initialize the supply flow only when we are connected
    if (isConnectedAndEnabled) {
      if (tabIndex === 0) {
        setWidgetState({
          flow: StUSDSFlow.SUPPLY,
          action: StUSDSAction.SUPPLY,
          screen: StUSDSScreen.ACTION
        });
      } else if (tabIndex === 1) {
        //Initialize the withdraw flow
        setWidgetState({
          flow: StUSDSFlow.WITHDRAW,
          action: StUSDSAction.WITHDRAW,
          screen: StUSDSScreen.ACTION
        });
      }
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: tabIndex === 0 ? StUSDSFlow.SUPPLY : StUSDSFlow.WITHDRAW,
        action: null,
        screen: null
      });
    }
  }, [tabIndex, isConnectedAndEnabled]);

  // If we're in the supply flow, need allowance and  batch transactions are not supported, set the action to approve,
  useEffect(() => {
    if (
      widgetState.flow === StUSDSFlow.SUPPLY &&
      (widgetState.screen === StUSDSScreen.ACTION || widgetState.screen === StUSDSScreen.REVIEW)
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action:
          needsAllowance && !allowanceLoading && !shouldUseBatch && !isBatchSupportLoading
            ? StUSDSAction.APPROVE
            : StUSDSAction.SUPPLY
      }));
    }
  }, [
    widgetState.flow,
    widgetState.screen,
    needsAllowance,
    allowanceLoading,
    shouldUseBatch,
    isBatchSupportLoading
  ]);

  useEffect(() => {
    setShowStepIndicator(widgetState.flow === StUSDSFlow.SUPPLY);
  }, [widgetState.flow]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    ((stUsdsData?.userUsdsBalance !== undefined && debouncedAmount > stUsdsData.userUsdsBalance) ||
      (stUsdsData?.userMaxDeposit !== undefined && debouncedAmount > stUsdsData.userMaxDeposit))
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    stUsdsData?.userMaxWithdraw !== undefined &&
    debouncedAmount > stUsdsData.userMaxWithdraw
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    !stUsdsWithdraw.prepared ||
    isAmountWaitingForDebounce;

  const supplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    allowance === undefined ||
    !stUsdsDeposit.prepared ||
    stUsdsDeposit.isLoading ||
    isAmountWaitingForDebounce;

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !batchSavingsSupply.prepared ||
    batchSavingsSupply.isLoading ||
    isAmountWaitingForDebounce ||
    // If the user has allowance, don't send a batch transaction as it's only 1 contract call
    !needsAllowance ||
    allowanceLoading ||
    !batchSupported;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !stUsdsApprove.prepared ||
    stUsdsApprove.isLoading ||
    (txStatus === TxStatus.SUCCESS && !stUsdsDeposit.prepared) || //disable next button if supply not prepared
    allowance === undefined ||
    isAmountWaitingForDebounce ||
    (!!batchEnabled && isBatchSupportLoading);

  const approveOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: StUSDSScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    stUsdsApprove.execute();
  };

  const supplyOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: StUSDSScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    stUsdsDeposit.execute();
  };

  const batchSupplyOnClick = () => {
    if (!needsAllowance) {
      // If the user does not need allowance, just send the individual transaction as it will be more gas efficient
      supplyOnClick();
      return;
    }
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: StUSDSScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    batchSavingsSupply.execute();
  };

  const withdrawOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: StUSDSScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    stUsdsWithdraw.execute();
  };

  // Handle external state changes
  useEffect(() => {
    const tokenDecimals = getTokenDecimals(usds, chainId);
    const formattedAmount = formatUnits(amount, tokenDecimals);
    const amountHasChanged =
      validatedExternalState?.amount !== undefined && validatedExternalState?.amount !== formattedAmount;

    const tokenHasChanged = externalWidgetState?.token?.toLowerCase() !== usds.symbol.toLowerCase();

    if ((amountHasChanged || tokenHasChanged) && txStatus === TxStatus.IDLE) {
      // Only set amount if there's a valid amount in external state
      if (validatedExternalState?.amount && validatedExternalState.amount !== '0') {
        const newAmount = parseUnits(validatedExternalState.amount, tokenDecimals);
        setAmount(newAmount);
      } else {
        // If amount is explicitly empty string, clear the input
        setAmount(0n);
      }
    }
  }, [validatedExternalState?.amount, txStatus]);

  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action:
        prev.flow === StUSDSFlow.WITHDRAW
          ? StUSDSAction.WITHDRAW
          : needsAllowance
            ? StUSDSAction.APPROVE
            : StUSDSAction.SUPPLY,
      screen: StUSDSScreen.ACTION
    }));

    // if successful supply/withdraw, reset amount
    if (widgetState.action !== StUSDSAction.APPROVE) {
      setAmount(0n);
      // Notify external state about the cleared amount with IDLE status
      onWidgetStateChange?.({
        originAmount: '',
        txStatus: TxStatus.IDLE,
        widgetState
      });
    }

    // if successfully approved, go to supply/withdraw
    if (widgetState.action === StUSDSAction.APPROVE && !needsAllowance) {
      return widgetState.flow === StUSDSFlow.SUPPLY ? supplyOnClick() : withdrawOnClick();
    }
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: StUSDSScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: StUSDSScreen.ACTION
    }));
  };

  // Handle the error onClicks separately to keep it clean
  const errorOnClick = () => {
    return widgetState.action === StUSDSAction.SUPPLY
      ? shouldUseBatch
        ? batchSupplyOnClick()
        : supplyOnClick()
      : widgetState.action === StUSDSAction.WITHDRAW
        ? withdrawOnClick()
        : widgetState.action === StUSDSAction.APPROVE
          ? approveOnClick()
          : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : widgetState.screen === StUSDSScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === StUSDSFlow.SUPPLY
            ? shouldUseBatch
              ? batchSupplyOnClick
              : widgetState.action === StUSDSAction.APPROVE
                ? approveOnClick
                : supplyOnClick
            : widgetState.flow === StUSDSFlow.WITHDRAW && widgetState.action === StUSDSAction.WITHDRAW
              ? withdrawOnClick
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === StUSDSScreen.REVIEW;

  useEffect(() => {
    if (stUsdsDeposit.prepareError) {
      console.log(stUsdsDeposit.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: stUsdsDeposit.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [stUsdsDeposit.prepareError]);

  useEffect(() => {
    if (stUsdsWithdraw.prepareError) {
      console.log(stUsdsWithdraw.prepareError);

      // Check for specific error types
      const errorMessage = stUsdsWithdraw.prepareError.message;
      let title = t`Error preparing transaction`;
      let description = stUsdsWithdraw.prepareError.message;

      if (errorMessage.includes('YUsds/insufficient-unused-funds')) {
        title = t`Insufficient liquidity`;
        description = t`The vault does not have enough available USDS for withdrawal. Please try a smaller amount or wait for liquidity to become available.`;
      }

      onNotification?.({
        title,
        description,
        status: TxStatus.ERROR
      });
    }
  }, [stUsdsWithdraw.prepareError]);

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS && widgetState.action !== StUSDSAction.APPROVE) {
        setButtonText(t`Back to stUSDS`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === StUSDSScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === StUSDSScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === StUSDSScreen.REVIEW) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (widgetState.action === StUSDSAction.APPROVE) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === StUSDSFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        } else if (widgetState.flow === StUSDSFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled, shouldUseBatch]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === StUSDSAction.SUPPLY &&
          (shouldUseBatch ? batchSupplyDisabled : supplyDisabled)) ||
          (widgetState.action === StUSDSAction.WITHDRAW && withdrawDisabled) ||
          (widgetState.action === StUSDSAction.APPROVE && approveDisabled))
    );
  }, [
    widgetState.action,
    supplyDisabled,
    withdrawDisabled,
    approveDisabled,
    isConnectedAndEnabled,
    shouldUseBatch,
    batchSupplyDisabled
  ]);

  // After a successful approval, wait for the next hook (supply) to be prepared and send the transaction
  useEffect(() => {
    if (
      widgetState.action === StUSDSAction.APPROVE &&
      txStatus === TxStatus.SUCCESS &&
      stUsdsDeposit.prepared
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: StUSDSAction.SUPPLY
      }));
      supplyOnClick();
    }
  }, [widgetState.action, txStatus, stUsdsDeposit.prepared]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(
      isConnecting ||
        txStatus === TxStatus.LOADING ||
        txStatus === TxStatus.INITIALIZED ||
        // Keep the loading state after a successful approval as a new transaction will automatically pop up
        (widgetState.action === StUSDSAction.APPROVE && txStatus === TxStatus.SUCCESS)
    );
  }, [isConnecting, txStatus, widgetState.action]);

  const debouncedBalanceError = useDebounce(isSupplyBalanceError, 2000);
  useEffect(() => {
    if (debouncedBalanceError) {
      onNotification?.({
        title: t`Error preparing transaction`,
        description: t`An error occurred while preparing the transaction`,
        status: TxStatus.ERROR,
        type: NotificationType.INSUFFICIENT_BALANCE
      });
    }
  }, [debouncedBalanceError]);

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setAmount(initialAmount);
    setMax(false);
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    // Reset widget state to initial screen based on current tab
    if (tabIndex === 0) {
      setWidgetState({
        flow: StUSDSFlow.SUPPLY,
        action: StUSDSAction.SUPPLY,
        screen: StUSDSScreen.ACTION
      });
    } else {
      setWidgetState({
        flow: StUSDSFlow.WITHDRAW,
        action: StUSDSAction.WITHDRAW,
        screen: StUSDSScreen.ACTION
      });
    }

    // Refresh data
    mutateStUsds();
    mutateAllowance();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        <div>
          {onBackToExpert && (
            <Button variant="link" onClick={onBackToExpert} className="mb-2 p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  Back to Expert
                </Heading>
              </HStack>
            </Button>
          )}
          <div className="space-y-1">
            <Heading variant="x-large">
              <Trans>stUSDS Module</Trans>
            </Heading>
            <Text className="text-textSecondary" variant="small">
              <Trans>Earn a variable rate on USDS by participating in SKY-backed borrowing</Trans>
            </Text>
          </div>
        </div>
      }
      rightHeader={rightHeaderComponent}
      footer={
        <WidgetButtons
          onClickAction={onClickAction}
          onClickBack={onClickBack}
          showSecondaryButton={showSecondaryButton}
          enabled={enabled}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {usds && txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <StUSDSTransactionStatus
              originToken={usds}
              originAmount={debouncedAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === StUSDSScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <StUSDSTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              originToken={usds}
              originAmount={debouncedAmount}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <StUSDSSupplyWithdraw
              address={address}
              nstBalance={stUsdsData?.userUsdsBalance}
              userUsdsBalance={stUsdsData?.userSuppliedUsds}
              withdrawableBalance={stUsdsData?.userMaxWithdraw}
              maxDeposit={stUsdsData?.userMaxDeposit}
              totalAssets={stUsdsData?.totalAssets}
              availableLiquidity={stUsdsData?.availableLiquidity}
              utilizationRate={capacityData?.utilizationRate}
              moduleRate={stUsdsData?.moduleRate}
              isStUsdsDataLoading={isStUsdsDataLoading}
              onChange={(newValue: bigint, userTriggered?: boolean) => {
                setAmount(newValue);
                if (userTriggered) {
                  // If newValue is 0n and it was triggered by user, it means they're clearing the input
                  const formattedValue =
                    newValue === 0n ? '' : formatUnits(newValue, getTokenDecimals(usds, chainId));
                  onWidgetStateChange?.({
                    originAmount: formattedValue,
                    txStatus,
                    widgetState
                  });
                }
              }}
              onToggle={setTabIndex}
              amount={amount}
              error={widgetState.flow === StUSDSFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError}
              onSetMax={setMax}
              tabIndex={tabIndex}
              enabled={enabled}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
