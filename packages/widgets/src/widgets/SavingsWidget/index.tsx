import {
  getTokenDecimals,
  TOKENS,
  useSavingsAllowance,
  useSavingsApprove,
  useSavingsData,
  useSavingsSupply,
  useSavingsWithdraw
} from '@jetstreamgg/hooks';
import { getEtherscanLink, useDebounce, formatBigInt } from '@jetstreamgg/utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@/shared/components/ui/widget/WidgetContainer';
import { SavingsFlow, SavingsAction, SavingsScreen } from './lib/constants';
import { SavingsTransactionStatus } from './components/SavingsTransactionStatus';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { WidgetContext, WidgetProvider } from '@/context/WidgetContext';
import { NotificationType, TxStatus } from '@/shared/constants';
import { WidgetProps, WidgetState } from '@/shared/types/widgetState';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { Heading } from '@/shared/components/ui/Typography';
import { getValidatedState } from '@/lib/utils';
import { formatUnits, parseUnits } from 'viem';
import { WidgetButtons } from '@/shared/components/ui/widget/WidgetButtons';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@/shared/hooks/useNotifyWidgetState';

export type SavingsWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const SavingsWidget = ({
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
  referralCode
}: SavingsWidgetProps) => {
  return (
    <ErrorBoundary componentName="SavingsWidget">
      <WidgetProvider locale={locale}>
        <SavingsWidgetWrapped
          onConnect={onConnect}
          addRecentTransaction={addRecentTransaction}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={onWidgetStateChange}
          onExternalLinkClicked={onExternalLinkClicked}
          enabled={enabled}
          referralCode={referralCode}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
};

// HOC Widget
const SavingsWidgetWrapped = ({
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  referralCode
}: SavingsWidgetProps) => {
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const { mutate: mutateSavings, data: savingsData, isLoading: isSavingsDataLoading } = useSavingsData();
  const { data: allowance, mutate: mutateAllowance, isLoading: allowanceLoading } = useSavingsAllowance();
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, 18)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === SavingsFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [max, setMax] = useState<boolean>(false);
  const linguiCtx = useLingui();
  const usds = TOKENS.usds;

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

  const savingsApprove = useSavingsApprove({
    amount: debouncedAmount,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedAmount)} USDS`
      });
      setExternalLink(getEtherscanLink(chainId, hash, 'tx'));
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
      savingsSupply.retryPrepare();
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
    enabled: widgetState.action === SavingsAction.APPROVE && allowance !== undefined
  });

  const savingsSupply = useSavingsSupply({
    amount: debouncedAmount,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Supplying ${formatBigInt(debouncedAmount)} USDS`
      });
      setExternalLink(getEtherscanLink(chainId, hash, 'tx'));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Supply successful`,
        description: t`You supplied ${formatBigInt(debouncedAmount)} USDS`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateSavings();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error, hash) => {
      onNotification?.({
        title: t`Supply failed`,
        description: t`Something went wrong with your transaction. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      mutateAllowance();
      mutateSavings();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    enabled: widgetState.action === SavingsAction.SUPPLY && allowance !== undefined,
    ref: referralCode
  });

  const savingsWithdraw = useSavingsWithdraw({
    amount: debouncedAmount,
    max,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Withdrawing ${formatBigInt(debouncedAmount)} USDS`
      });
      setExternalLink(getEtherscanLink(chainId, hash, 'tx'));
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
      mutateSavings();
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
      mutateSavings();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    enabled: widgetState.action === SavingsAction.WITHDRAW
  });

  const needsAllowance = !!(!allowance || allowance < debouncedAmount);

  useEffect(() => {
    //Initialize the supply flow only when we are connected
    if (isConnectedAndEnabled) {
      if (tabIndex === 0) {
        setWidgetState({
          flow: SavingsFlow.SUPPLY,
          action: SavingsAction.SUPPLY,
          screen: SavingsScreen.ACTION
        });
      } else if (tabIndex === 1) {
        //Initialize the withdraw flow
        setWidgetState({
          flow: SavingsFlow.WITHDRAW,
          action: SavingsAction.WITHDRAW,
          screen: SavingsScreen.ACTION
        });
      }
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: tabIndex === 0 ? SavingsFlow.SUPPLY : SavingsFlow.WITHDRAW,
        action: null,
        screen: null
      });
    }
  }, [tabIndex, isConnectedAndEnabled]);

  // If we're in the supply flow and we need allowance, set the action to approve,
  useEffect(() => {
    if (widgetState.flow === SavingsFlow.SUPPLY && widgetState.screen === SavingsScreen.ACTION) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: needsAllowance && !allowanceLoading ? SavingsAction.APPROVE : SavingsAction.SUPPLY
      }));
    }
  }, [widgetState.flow, widgetState.screen, needsAllowance, allowanceLoading]);

  useEffect(() => {
    setShowStepIndicator(widgetState.flow === SavingsFlow.SUPPLY);
  }, [widgetState.flow]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    (savingsData?.userNstBalance || savingsData?.userNstBalance === 0n) &&
    debouncedAmount > savingsData.userNstBalance &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    (savingsData?.userSavingsBalance === 0n || !!savingsData?.userSavingsBalance) &&
    debouncedAmount > savingsData.userSavingsBalance &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    !savingsWithdraw.prepared ||
    isAmountWaitingForDebounce;

  const supplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    allowance === undefined ||
    !savingsSupply.prepared ||
    savingsSupply.isLoading ||
    isAmountWaitingForDebounce;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !savingsApprove.prepared ||
    savingsApprove.isLoading ||
    (txStatus === TxStatus.SUCCESS && !savingsSupply.prepared) || //disable next button if supply not prepared
    allowance === undefined ||
    isAmountWaitingForDebounce;

  const approveOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: SavingsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    savingsApprove.execute();
  };

  const supplyOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: SavingsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    savingsSupply.execute();
  };

  const withdrawOnClick = () => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: SavingsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    savingsWithdraw.execute();
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
        prev.flow === SavingsFlow.WITHDRAW
          ? SavingsAction.WITHDRAW
          : needsAllowance
            ? SavingsAction.APPROVE
            : SavingsAction.SUPPLY,
      screen: SavingsScreen.ACTION
    }));

    // if successful supply/withdraw, reset amount
    if (widgetState.action !== SavingsAction.APPROVE) {
      setAmount(0n);
    }

    // if successfully approved, go to supply/withdraw
    if (widgetState.action === SavingsAction.APPROVE && !needsAllowance) {
      return widgetState.flow === SavingsFlow.SUPPLY ? supplyOnClick() : withdrawOnClick();
    }
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: SavingsScreen.ACTION
    }));
  };

  // Handle the error onClicks separately to keep it clean
  const errorOnClick = () => {
    return widgetState.action === SavingsAction.SUPPLY
      ? supplyOnClick
      : widgetState.action === SavingsAction.WITHDRAW
        ? withdrawOnClick
        : widgetState.action === SavingsAction.APPROVE
          ? approveOnClick
          : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : widgetState.flow === SavingsFlow.SUPPLY &&
        widgetState.action === SavingsAction.APPROVE &&
        txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.SUCCESS
        ? nextOnClick
        : txStatus === TxStatus.ERROR
          ? errorOnClick()
          : widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.APPROVE
            ? approveOnClick
            : widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.SUPPLY
              ? supplyOnClick
              : widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.WITHDRAW
                ? withdrawOnClick
                : undefined;

  const showSecondaryButton =
    txStatus === TxStatus.ERROR ||
    // After a successful approve transaction, show the back button
    (txStatus === TxStatus.SUCCESS &&
      widgetState.action === SavingsAction.APPROVE &&
      widgetState.screen === SavingsScreen.TRANSACTION);

  useEffect(() => {
    if (savingsSupply.prepareError) {
      console.log(savingsSupply.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: savingsSupply.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [savingsSupply.prepareError]);

  useEffect(() => {
    if (savingsWithdraw.prepareError) {
      console.log(savingsWithdraw.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: savingsWithdraw.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [savingsWithdraw.prepareError]);

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (
        widgetState.flow === SavingsFlow.SUPPLY &&
        widgetState.action === SavingsAction.APPROVE &&
        txStatus === TxStatus.SUCCESS
      ) {
        setButtonText(t`Continue`);
      } else if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Back to Savings`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === SavingsScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.APPROVE) {
        setButtonText(t`Approve supply amount`);
      } else if (widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.SUPPLY) {
        setButtonText(t`Supply`);
      } else if (widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.WITHDRAW) {
        setButtonText(t`Withdraw`);
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === SavingsAction.SUPPLY && supplyDisabled) ||
          (widgetState.action === SavingsAction.WITHDRAW && withdrawDisabled) ||
          (widgetState.action === SavingsAction.APPROVE && approveDisabled))
    );
  }, [widgetState.action, supplyDisabled, withdrawDisabled, approveDisabled, isConnectedAndEnabled]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus]);

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

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Sky Savings Rate</Trans>
        </Heading>
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
            <SavingsTransactionStatus
              originToken={usds}
              originAmount={debouncedAmount}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <SupplyWithdraw
              address={address}
              nstBalance={savingsData?.userNstBalance}
              savingsBalance={savingsData?.userSavingsBalance}
              savingsTvl={savingsData?.savingsTvl}
              isSavingsDataLoading={isSavingsDataLoading}
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
              error={widgetState.flow === SavingsFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError}
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
