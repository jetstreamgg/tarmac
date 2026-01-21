import {
  getTokenDecimals,
  TOKENS,
  useStUsdsAllowance,
  useStUsdsData,
  useStUsdsCapacityData,
  useIsBatchSupported,
  useStUsdsProviderSelection,
  StUsdsProviderType,
  StUsdsDirection,
  useCurveAllowance,
  useStUsdsWithdrawBalances
} from '@jetstreamgg/sky-hooks';
import { useDebounce } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import {
  StUSDSFlow,
  StUSDSAction,
  StUSDSScreen,
  MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING
} from './lib/constants';
import { StUSDSTransactionStatus } from './components/StUSDSTransactionStatus';
import { StUSDSSupplyWithdraw } from './components/StUSDSSupplyWithdraw';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useConnection, useChainId } from 'wagmi';
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
  const { address, isConnecting, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const { mutate: mutateStUsds, data: stUsdsData, isLoading: isStUsdsDataLoading } = useStUsdsData();
  const { data: capacityData } = useStUsdsCapacityData();
  const { data: nativeSupplyAllowance, mutate: mutateNativeSupplyAllowance } = useStUsdsAllowance();
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, 18)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === StUSDSFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [max, setMax] = useState<boolean>(false);
  const [swapAnyway, setSwapAnyway] = useState<boolean>(false);
  const linguiCtx = useLingui();
  const usds = TOKENS.usds;
  const { data: batchSupported } = useIsBatchSupported();

  // Reference amount for rate comparison when actual amount is 0
  // This allows pre-selecting the provider before user input to prevent UI flicker
  const referenceAmount = parseUnits('1', 18); // 1 USDS

  // Provider selection for automatic routing between native and Curve
  const providerSelection = useStUsdsProviderSelection({
    amount: debouncedAmount,
    referenceAmount,
    direction: tabIndex === 0 ? StUsdsDirection.SUPPLY : StUsdsDirection.WITHDRAW,
    userStUsdsBalance: stUsdsData?.userStUsdsBalance,
    isMax: max
  });

  const { hasAllowance: hasCurveUsdsAllowance, mutate: mutateCurveUsdsAllowance } = useCurveAllowance({
    token: 'USDS',
    amount: debouncedAmount
  });
  const { hasAllowance: hasCurveStUsdsAllowance, mutate: mutateCurveStUsdsAllowance } = useCurveAllowance({
    token: 'stUSDS',
    amount: providerSelection?.selectedQuote?.stUsdsAmount ?? 0n
  });

  const {
    effectiveBalance: withdrawBalanceLimit,
    curveMaxWithdraw,
    selectedProvider: withdrawSelectedProvider
  } = useStUsdsWithdrawBalances();

  const isCurveSelected = providerSelection.selectedProvider === StUsdsProviderType.CURVE;

  // If Curve is available, don't enforce native capacity limits on supply input
  const isCurveAvailableForSupply = providerSelection.curveProvider?.state?.canDeposit ?? false;

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  // Reset swapAnyway when amount or tab changes
  useEffect(() => {
    setSwapAnyway(false);
  }, [debouncedAmount, tabIndex]);

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

  const needsAllowance = useMemo(() => {
    if (widgetState.flow === StUSDSFlow.SUPPLY) {
      return isCurveSelected
        ? !hasCurveUsdsAllowance
        : !!(!nativeSupplyAllowance || nativeSupplyAllowance < debouncedAmount);
    } else {
      return isCurveSelected ? !hasCurveStUsdsAllowance : false;
    }
  }, [
    widgetState.flow,
    isCurveSelected,
    hasCurveUsdsAllowance,
    hasCurveStUsdsAllowance,
    nativeSupplyAllowance,
    debouncedAmount
  ]);

  const shouldUseBatch = !!batchEnabled && !!batchSupported && needsAllowance;

  const { batchStUsdsDeposit, stUsdsWithdraw } = useStUsdsTransactions({
    amount,
    referralCode,
    max,
    shouldUseBatch,
    mutateNativeSupplyAllowance,
    mutateStUsds,
    mutateCurveUsdsAllowance,
    mutateCurveStUsdsAllowance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    selectedProvider: providerSelection.selectedProvider,
    expectedOutput: providerSelection.selectedQuote?.outputAmount ?? 0n,
    // For Curve withdrawals: stUsdsAmount is the calculated stUSDS input needed
    stUsdsAmount: providerSelection.selectedQuote?.stUsdsAmount
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
      setShowStepIndicator(needsAllowance);
    }
  }, [txStatus, needsAllowance, setShowStepIndicator]);

  const remainingCapacityBuffered = capacityData?.remainingCapacityBuffered || 0n;

  // Use provider-aware max amounts based on Curve availability
  // When Curve is available, there's no protocol limit; when only native is available, use module capacity limit
  const moduleMaxSupplyAmount = isCurveAvailableForSupply
    ? undefined
    : (providerSelection.nativeProvider?.state?.maxDeposit ?? remainingCapacityBuffered);

  // For Curve: use user's max based on their stUSDS balance converted at Curve's rate (unbuffered)
  // For Native: use user's max withdrawable from contract (buffered to prevent liquidity issues)
  const nativeMaxWithdraw = stUsdsData?.userMaxWithdrawBuffered ?? 0n;
  // Max withdraw uses rate comparison
  const maxWithdrawAmount =
    withdrawSelectedProvider === StUsdsProviderType.CURVE
      ? (curveMaxWithdraw ?? nativeMaxWithdraw)
      : nativeMaxWithdraw;

  // Update amount when max is true and maxWithdrawAmount changes
  // This keeps the input synced with the latest max value when user has clicked 100%
  useEffect(() => {
    if (
      max &&
      widgetState.flow === StUSDSFlow.WITHDRAW &&
      maxWithdrawAmount > 0n &&
      txStatus === TxStatus.IDLE
    ) {
      setAmount(maxWithdrawAmount);
    }
  }, [max, maxWithdrawAmount, widgetState.flow, txStatus]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    !providerSelection.isLoading &&
    ((stUsdsData?.userUsdsBalance !== undefined && debouncedAmount > stUsdsData.userUsdsBalance) ||
      (providerSelection.allProvidersBlocked && debouncedAmount > 0n) ||
      (moduleMaxSupplyAmount !== undefined && debouncedAmount > moduleMaxSupplyAmount))
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    amount !== 0n && //don't wait for debouncing on default state
    !providerSelection.isLoading &&
    ((withdrawBalanceLimit !== undefined && debouncedAmount > withdrawBalanceLimit) ||
      (providerSelection.allProvidersBlocked && debouncedAmount > 0n) ||
      (maxWithdrawAmount !== undefined && debouncedAmount > maxWithdrawAmount))
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    (txStatus === TxStatus.IDLE && !stUsdsWithdraw.prepared) ||
    isAmountWaitingForDebounce ||
    debouncedAmount === 0n;

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !batchStUsdsDeposit.prepared ||
    batchStUsdsDeposit.isLoading ||
    isAmountWaitingForDebounce ||
    debouncedAmount === 0n;

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
    setMax(false);

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

  // Handle prepare errors for native and Curve hooks
  const withdrawPrepareError = 'prepareError' in stUsdsWithdraw ? stUsdsWithdraw.prepareError : null;
  const supplyError = batchStUsdsDeposit.error;
  const withdrawError = stUsdsWithdraw.error;

  useEffect(() => {
    const error = withdrawPrepareError || withdrawError;
    if (error && widgetState.flow === StUSDSFlow.WITHDRAW) {
      const errorMessage = (error as Error).message || '';
      let title = t`Error preparing transaction`;
      let description = (error as Error).message;

      // Native stUSDS errors
      if (errorMessage.includes('YUsds/insufficient-unused-funds')) {
        title = t`Insufficient liquidity`;
        description = t`The vault does not have enough available USDS for withdrawal. Please try a smaller amount or wait for liquidity to become available.`;
      }
      // Curve-specific errors
      else if (errorMessage.includes('Exchange resulted in fewer coins')) {
        title = t`Slippage exceeded`;
        description = t`The swap would result in less output than the minimum acceptable amount. Try reducing the amount or waiting for better rates.`;
      } else if (errorMessage.includes('Insufficient balance')) {
        title = t`Insufficient pool liquidity`;
        description = t`The Curve pool does not have enough liquidity for this swap. Please try a smaller amount.`;
      }

      onNotification?.({
        title,
        description,
        status: TxStatus.ERROR
      });
    }
  }, [withdrawPrepareError, withdrawError, widgetState.flow]);

  useEffect(() => {
    if (supplyError && widgetState.flow === StUSDSFlow.SUPPLY) {
      const errorMessage = (supplyError as Error).message || '';
      let title = t`Error preparing transaction`;
      let description = (supplyError as Error).message;

      // Curve-specific errors
      if (errorMessage.includes('Exchange resulted in fewer coins')) {
        title = t`Slippage exceeded`;
        description = t`The swap would result in less output than the minimum acceptable amount. Try reducing the amount or waiting for better rates.`;
      } else if (errorMessage.includes('Insufficient balance')) {
        title = t`Insufficient pool liquidity`;
        description = t`The Curve pool does not have enough liquidity for this swap. Please try a smaller amount.`;
      }

      onNotification?.({
        title,
        description,
        status: TxStatus.ERROR
      });
    }
  }, [supplyError, widgetState.flow]);

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

    // Disable if Curve is selected with high price impact and user hasn't acknowledged
    const priceImpactBps = providerSelection.selectedQuote?.rateInfo.priceImpactBps ?? 0;
    const isDisabledForPriceImpact =
      isCurveSelected &&
      widgetState.screen === StUSDSScreen.ACTION &&
      priceImpactBps >= MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING &&
      !swapAnyway &&
      txStatus === TxStatus.IDLE;

    setIsDisabled(isConnectedAndEnabled && (isDisabledForAction || isDisabledForPriceImpact));
  }, [
    widgetState.action,
    widgetState.screen,
    withdrawDisabled,
    isConnectedAndEnabled,
    batchSupplyDisabled,
    isCurveSelected,
    providerSelection.selectedQuote?.rateInfo.priceImpactBps,
    swapAnyway,
    txStatus
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
    mutateNativeSupplyAllowance();
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
              isCurve={providerSelection.selectedProvider === StUsdsProviderType.CURVE}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === StUSDSScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <StUSDSTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              originToken={usds}
              originAmount={debouncedAmount}
              needsAllowance={needsAllowance}
              isCurve={providerSelection.selectedProvider === StUsdsProviderType.CURVE}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <StUSDSSupplyWithdraw
              address={address}
              nstBalance={stUsdsData?.userUsdsBalance}
              userUsdsBalance={withdrawBalanceLimit}
              userStUsdsBalance={stUsdsData?.userStUsdsBalance}
              withdrawableBalance={maxWithdrawAmount}
              totalAssets={stUsdsData?.totalAssets}
              availableLiquidityBuffered={stUsdsData?.availableLiquidityBuffered}
              moduleRate={stUsdsData?.moduleRate}
              isStUsdsDataLoading={isStUsdsDataLoading}
              remainingCapacityBuffered={remainingCapacityBuffered}
              providerSelection={providerSelection}
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
              swapAnyway={swapAnyway}
              onSwapAnywayChange={setSwapAnyway}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const StUSDSWidget = withWidgetProvider(StUSDSWidgetWrapped, 'StUSDSWidget');
