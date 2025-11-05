import {
  getTokenDecimals,
  TOKENS,
  useStUsdsAllowance,
  useStUsdsData,
  useStUsdsCapacityData,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { StUSDSFlow, StUSDSAction, StUSDSScreen } from './lib/constants';
import { StUSDSTransactionStatus } from './components/StUSDSTransactionStatus';
import { StUSDSSupplyWithdraw } from './components/StUSDSSupplyWithdraw';
import { WidgetContext } from '@widgets/context/WidgetContext';
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
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { StUSDSTransactionReview } from './components/StUSDSTransactionReview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useStUsdsTransactions } from './hooks/useStUsdsTransactions';

export type StUSDSWidgetProps = WidgetProps & {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  onBackToExpert?: () => void;
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
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const { mutate: mutateStUsds, data: stUsdsData, isLoading: isStUsdsDataLoading } = useStUsdsData();
  const { data: capacityData } = useStUsdsCapacityData();
  const { data: allowance, mutate: mutateAllowance } = useStUsdsAllowance();
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, 18)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === StUSDSFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [max, setMax] = useState<boolean>(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState<boolean>(false);
  const linguiCtx = useLingui();
  const usds = TOKENS.usds;
  const { data: batchSupported } = useIsBatchSupported();

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

  const needsAllowance = !!(!allowance || allowance < debouncedAmount);
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === StUSDSFlow.SUPPLY;

  const { batchStUsdsDeposit, stUsdsWithdraw } = useStUsdsTransactions({
    amount,
    referralCode,
    max,
    shouldUseBatch,
    mutateAllowance,
    mutateStUsds,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

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

  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(widgetState.flow === StUSDSFlow.SUPPLY && needsAllowance);
    }
  }, [txStatus, widgetState.flow, needsAllowance, setShowStepIndicator]);

  const remainingCapacityBuffered = capacityData?.remainingCapacityBuffered || 0n;

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    ((stUsdsData?.userUsdsBalance !== undefined && debouncedAmount > stUsdsData.userUsdsBalance) ||
      (remainingCapacityBuffered !== undefined && debouncedAmount > remainingCapacityBuffered))
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    stUsdsData?.userMaxWithdrawBuffered !== undefined &&
    debouncedAmount > stUsdsData.userMaxWithdrawBuffered
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    (txStatus === TxStatus.IDLE && !stUsdsWithdraw.prepared) ||
    isAmountWaitingForDebounce;

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !batchStUsdsDeposit.prepared ||
    batchStUsdsDeposit.isLoading ||
    isAmountWaitingForDebounce;

  const hasUsdsWalletBalance = stUsdsData?.userUsdsBalance !== undefined && stUsdsData.userUsdsBalance > 0n;

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
    setAmount(0n);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: prev.flow === StUSDSFlow.WITHDRAW ? StUSDSAction.WITHDRAW : StUSDSAction.SUPPLY,
      screen: StUSDSScreen.ACTION
    }));

    // Notify external state about the cleared amount
    onWidgetStateChange?.({
      originAmount: '',
      txStatus,
      widgetState
    });
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
      ? batchStUsdsDeposit.execute()
      : widgetState.action === StUSDSAction.WITHDRAW
        ? stUsdsWithdraw.execute()
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
            ? batchStUsdsDeposit.execute
            : widgetState.flow === StUSDSFlow.WITHDRAW
              ? stUsdsWithdraw.execute
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === StUSDSScreen.REVIEW;

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
      if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Back to stUSDS`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === StUSDSScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === StUSDSScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === StUSDSScreen.REVIEW) {
        if (widgetState.flow === StUSDSFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        } else if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === StUSDSFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled, shouldUseBatch, needsAllowance]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    const isDisabledForAction =
      (widgetState.action === StUSDSAction.SUPPLY && batchSupplyDisabled) ||
      (widgetState.action === StUSDSAction.WITHDRAW && withdrawDisabled);

    const shouldEnforceDisclaimer =
      widgetState.action === StUSDSAction.SUPPLY &&
      widgetState.screen === StUSDSScreen.ACTION &&
      (isStUsdsDataLoading || hasUsdsWalletBalance);

    const isDisabledForDisclaimer = shouldEnforceDisclaimer && (isStUsdsDataLoading || !disclaimerChecked);

    setIsDisabled(isConnectedAndEnabled && (isDisabledForAction || isDisabledForDisclaimer));
  }, [
    widgetState.action,
    widgetState.screen,
    withdrawDisabled,
    isConnectedAndEnabled,
    batchSupplyDisabled,
    disclaimerChecked,
    amount,
    hasUsdsWalletBalance,
    isStUsdsDataLoading
  ]);

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
          <Heading variant="x-large">
            <Trans>stUSDS</Trans>
          </Heading>
        </div>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Access a variable reward rate on USDS by participating in SKY-backed borrowing</Trans>
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
              userStUsdsBalance={stUsdsData?.userStUsdsBalance}
              withdrawableBalance={stUsdsData?.userMaxWithdrawBuffered}
              totalAssets={stUsdsData?.totalAssets}
              availableLiquidityBuffered={stUsdsData?.availableLiquidityBuffered}
              moduleRate={stUsdsData?.moduleRate}
              isStUsdsDataLoading={isStUsdsDataLoading}
              remainingCapacityBuffered={remainingCapacityBuffered}
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
              disclaimerChecked={disclaimerChecked}
              onDisclaimerChange={setDisclaimerChecked}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const StUSDSWidget = withWidgetProvider(StUSDSWidgetWrapped, 'StUSDSWidget');
