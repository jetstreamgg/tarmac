import {
  getTokenDecimals,
  TOKENS,
  useSavingsAllowance,
  useSavingsData,
  useIsBatchSupported,
  Token,
  useTokenBalance
} from '@jetstreamgg/sky-hooks';
import { isTestnetId, useDebounce } from '@jetstreamgg/sky-utils';
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
import { useConnection, useChainId } from 'wagmi';
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
import { tokenForSymbol } from '../L2SavingsWidget/lib/helpers';

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
  const validatedExternalState = getValidatedState(externalWidgetState, ['USDS', 'DAI']);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const { mutate: mutateSavings, data: savingsData, isLoading: isSavingsDataLoading } = useSavingsData();
  const { data: allowance, mutate: mutateAllowance } = useSavingsAllowance();
  const initialAmount =
    validatedExternalState?.amount && validatedExternalState.amount !== '0'
      ? parseUnits(validatedExternalState.amount, 18)
      : 0n;
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === SavingsFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const [originToken, setOriginToken] = useState<Token>(
    tokenForSymbol(validatedExternalState?.token || 'USDS')
  );
  const [max, setMax] = useState<boolean>(false);
  const linguiCtx = useLingui();
  const isUpgradeSupplyFlow = originToken.symbol === TOKENS.dai.symbol;
  const { data: batchSupported } = useIsBatchSupported();

  // Balance of the tokens to be supplied
  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    chainId,
    address,
    token: originToken.address[chainId]
  });

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

  useEffect(() => {
    // We only support DAI for supply flows. For withdrawals it should always use USDS
    const tokenSymbolToUse =
      widgetState.flow === SavingsFlow.SUPPLY && !!validatedExternalState?.token
        ? validatedExternalState?.token
        : 'USDS';
    setOriginToken(tokenForSymbol(tokenSymbolToUse));
  }, [validatedExternalState?.token, widgetState.flow]);

  const needsAllowance = !!(!allowance || allowance < debouncedAmount);
  const shouldUseBatch =
    !!batchEnabled &&
    !!batchSupported &&
    (isUpgradeSupplyFlow || needsAllowance) &&
    widgetState.flow === SavingsFlow.SUPPLY;

  const { batchSavingsSupply, batchUpgradeAndSupply, savingsWithdraw } = useSavingsTransactions({
    amount: debouncedAmount,
    max,
    referralCode,
    originToken,
    shouldUseBatch,
    mutateAllowance,
    mutateSavings,
    mutateOriginBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

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

  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(widgetState.flow === SavingsFlow.SUPPLY && needsAllowance);
    }
  }, [txStatus, widgetState.flow, needsAllowance, setShowStepIndicator]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    address &&
    (originBalance?.value || originBalance?.value === 0n) &&
    debouncedAmount > originBalance.value &&
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

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    isAmountWaitingForDebounce ||
    (isUpgradeSupplyFlow
      ? // Disable Upgrade + Supply flows if batch txs are not enabled and it's not a testnet
        !batchUpgradeAndSupply.prepared ||
        batchUpgradeAndSupply.isLoading ||
        ((!batchEnabled || !batchSupported) && !isTestnetId(chainId))
      : !batchSavingsSupply.prepared || batchSavingsSupply.isLoading);

  // Handle external state changes
  useEffect(() => {
    const tokenDecimals = getTokenDecimals(originToken, chainId);
    const formattedAmount = formatUnits(amount, tokenDecimals);
    const amountHasChanged =
      validatedExternalState?.amount !== undefined && validatedExternalState?.amount !== formattedAmount;

    const tokenHasChanged = externalWidgetState?.token?.toLowerCase() !== originToken.symbol.toLowerCase();

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
      action: prev.flow === SavingsFlow.WITHDRAW ? SavingsAction.WITHDRAW : SavingsAction.SUPPLY,
      screen: SavingsScreen.ACTION
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
      ? isUpgradeSupplyFlow
        ? batchUpgradeAndSupply.execute()
        : batchSavingsSupply.execute()
      : widgetState.action === SavingsAction.WITHDRAW
        ? savingsWithdraw.execute()
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
            ? isUpgradeSupplyFlow
              ? batchUpgradeAndSupply.execute
              : batchSavingsSupply.execute
            : widgetState.flow === SavingsFlow.WITHDRAW
              ? savingsWithdraw.execute
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === SavingsScreen.REVIEW;

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
      if (txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Back to Savings`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === SavingsScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === SavingsScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === SavingsScreen.REVIEW) {
        if (widgetState.flow === SavingsFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        } else if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === SavingsFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled, shouldUseBatch, needsAllowance]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === SavingsAction.SUPPLY && batchSupplyDisabled) ||
          (widgetState.action === SavingsAction.WITHDRAW && withdrawDisabled))
    );
  }, [widgetState.action, withdrawDisabled, isConnectedAndEnabled, batchSupplyDisabled]);

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
    mutateOriginBalance();
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
        {txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <SavingsTransactionStatus
              originToken={originToken}
              originAmount={debouncedAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
              isUpgradeSupplyFlow={isUpgradeSupplyFlow}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === SavingsScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <SavingsTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              originToken={originToken}
              originAmount={debouncedAmount}
              needsAllowance={needsAllowance}
              isUpgradeSupplyFlow={isUpgradeSupplyFlow}
              shouldUseBatch={shouldUseBatch}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <SupplyWithdraw
              address={address}
              originBalance={originBalance?.value}
              savingsBalance={savingsData?.userSavingsBalance}
              savingsTvl={savingsData?.savingsTvl}
              isSavingsDataLoading={isSavingsDataLoading}
              onChange={(newValue: bigint, userTriggered?: boolean) => {
                setAmount(newValue);
                if (userTriggered) {
                  // If newValue is 0n and it was triggered by user, it means they're clearing the input
                  const formattedValue =
                    newValue === 0n ? '' : formatUnits(newValue, getTokenDecimals(originToken, chainId));
                  onWidgetStateChange?.({
                    originAmount: formattedValue,
                    txStatus,
                    widgetState
                  });
                }
              }}
              originToken={originToken}
              onMenuItemChange={(op: Token | null) => {
                if (op) {
                  setOriginToken(op as Token);
                  onWidgetStateChange?.({ originToken: op.symbol, txStatus, widgetState });
                }
              }}
              onToggle={setTabIndex}
              amount={amount}
              error={widgetState.flow === SavingsFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError}
              onSetMax={setMax}
              tabIndex={tabIndex}
              enabled={enabled}
              onExternalLinkClicked={onExternalLinkClicked}
              isUpgradeSupplyFlow={isUpgradeSupplyFlow}
              shouldUseBatch={shouldUseBatch}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const SavingsWidget = withWidgetProvider(SavingsWidgetWrapped, 'SavingsWidget');
