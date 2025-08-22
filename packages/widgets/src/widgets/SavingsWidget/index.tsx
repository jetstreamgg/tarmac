import {
  getTokenDecimals,
  TOKENS,
  useSavingsAllowance,
  useSavingsData,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { SavingsFlow, SavingsAction, SavingsScreen } from './lib/constants';
import { SavingsTransactionStatus } from './components/SavingsTransactionStatus';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { SavingsTransactionReview } from './components/SavingsTransactionReview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useSavingsTransactions } from './hooks/useSavingsTransactions';

export type SavingsWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
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
  legalBatchTxUrl,
  referralCode,
  batchEnabled,
  setBatchEnabled
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

  const { savingsApprove, savingsSupply, batchSavingsSupply, savingsWithdraw } = useSavingsTransactions({
    amount: debouncedAmount,
    max,
    referralCode,
    allowance,
    mutateAllowance,
    mutateSavings,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const needsAllowance = !!(!allowance || allowance < debouncedAmount);
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === SavingsFlow.SUPPLY;

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

  // If we're in the supply flow, need allowance and  batch transactions are not supported, set the action to approve,
  useEffect(() => {
    if (
      widgetState.flow === SavingsFlow.SUPPLY &&
      (widgetState.screen === SavingsScreen.ACTION || widgetState.screen === SavingsScreen.REVIEW)
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action:
          needsAllowance && !allowanceLoading && !shouldUseBatch && !isBatchSupportLoading
            ? SavingsAction.APPROVE
            : SavingsAction.SUPPLY
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
    !savingsApprove.prepared ||
    savingsApprove.isLoading ||
    (txStatus === TxStatus.SUCCESS && !savingsSupply.prepared) || //disable next button if supply not prepared
    allowance === undefined ||
    isAmountWaitingForDebounce ||
    (!!batchEnabled && isBatchSupportLoading);

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

  const batchSupplyOnClick = () => {
    if (!needsAllowance) {
      // If the user does not need allowance, just send the individual transaction as it will be more gas efficient
      supplyOnClick();
      return;
    }
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: SavingsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    batchSavingsSupply.execute();
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
      // Notify external state about the cleared amount
      onWidgetStateChange?.({
        originAmount: '',
        txStatus,
        widgetState
      });
    }

    // if successfully approved, go to supply/withdraw
    if (widgetState.action === SavingsAction.APPROVE && !needsAllowance) {
      return widgetState.flow === SavingsFlow.SUPPLY ? supplyOnClick() : withdrawOnClick();
    }
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: SavingsScreen.REVIEW
    }));
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
      ? shouldUseBatch
        ? batchSupplyOnClick()
        : supplyOnClick()
      : widgetState.action === SavingsAction.WITHDRAW
        ? withdrawOnClick()
        : widgetState.action === SavingsAction.APPROVE
          ? approveOnClick()
          : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : widgetState.screen === SavingsScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === SavingsFlow.SUPPLY
            ? shouldUseBatch
              ? batchSupplyOnClick
              : widgetState.action === SavingsAction.APPROVE
                ? approveOnClick
                : supplyOnClick
            : widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.WITHDRAW
              ? withdrawOnClick
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === SavingsScreen.REVIEW;

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
      if (txStatus === TxStatus.SUCCESS && widgetState.action !== SavingsAction.APPROVE) {
        setButtonText(t`Back to Savings`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === SavingsScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === SavingsScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === SavingsScreen.REVIEW) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (widgetState.action === SavingsAction.APPROVE) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === SavingsFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        } else if (widgetState.flow === SavingsFlow.WITHDRAW) {
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
        ((widgetState.action === SavingsAction.SUPPLY &&
          (shouldUseBatch ? batchSupplyDisabled : supplyDisabled)) ||
          (widgetState.action === SavingsAction.WITHDRAW && withdrawDisabled) ||
          (widgetState.action === SavingsAction.APPROVE && approveDisabled))
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
      widgetState.action === SavingsAction.APPROVE &&
      txStatus === TxStatus.SUCCESS &&
      savingsSupply.prepared
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: SavingsAction.SUPPLY
      }));
      supplyOnClick();
    }
  }, [widgetState.action, txStatus, savingsSupply.prepared]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(
      isConnecting ||
        txStatus === TxStatus.LOADING ||
        txStatus === TxStatus.INITIALIZED ||
        // Keep the loading state after a successful approval as a new transaction will automatically pop up
        (widgetState.action === SavingsAction.APPROVE && txStatus === TxStatus.SUCCESS)
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
        flow: SavingsFlow.SUPPLY,
        action: SavingsAction.SUPPLY,
        screen: SavingsScreen.ACTION
      });
    } else {
      setWidgetState({
        flow: SavingsFlow.WITHDRAW,
        action: SavingsAction.WITHDRAW,
        screen: SavingsScreen.ACTION
      });
    }

    // Refresh data
    mutateSavings();
    mutateAllowance();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Sky Savings Rate</Trans>
        </Heading>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Use USDS to access the Sky Savings Rate</Trans>
        </Text>
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
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === SavingsScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <SavingsTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              originToken={usds}
              originAmount={debouncedAmount}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
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

export const SavingsWidget = withWidgetProvider(SavingsWidgetWrapped, 'SavingsWidget');
