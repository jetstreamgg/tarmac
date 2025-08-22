import {
  psm3L2Address,
  sUsdsL2Address,
  Token,
  TOKENS,
  useIsBatchSupported,
  useTokenAllowance,
  useTokenBalance,
  getTokenDecimals
} from '@jetstreamgg/sky-hooks';
import { useDebounce, math } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { SavingsFlow, SavingsAction, SavingsScreen } from '../SavingsWidget/lib/constants';
import { SavingsTransactionStatus } from '../SavingsWidget/components/SavingsTransactionStatus';
import { L2SavingsSupplyWithdraw } from './components/L2SavingsSupplyWithdraw';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus, EPOCH_LENGTH } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { usePreviewSwapExactIn, usePreviewSwapExactOut } from '@jetstreamgg/sky-hooks';
import {
  useReadSsrAuthOracleGetChi,
  useReadSsrAuthOracleGetRho,
  useReadSsrAuthOracleGetSsr
} from '@jetstreamgg/sky-hooks';
import { SavingsTransactionReview } from '../SavingsWidget/components/SavingsTransactionReview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useL2SavingsTransactions } from './hooks/useL2SavingsTransactions';
import { defaultDepositOptions, defaultWithdrawOptions } from './lib/constants';
import { calculateOriginOptions, tokenForSymbol } from './lib/helpers';

export type SavingsWidgetProps = WidgetProps & {
  disallowedTokens?: { [key in SavingsFlow]: Token[] };
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
  referralCode,
  disallowedTokens,
  batchEnabled,
  setBatchEnabled,
  legalBatchTxUrl
}: SavingsWidgetProps) => {
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

  const disallowedForFlow =
    disallowedTokens?.[SavingsFlow.WITHDRAW ? SavingsFlow.WITHDRAW : SavingsFlow.SUPPLY] || [];
  const allowedSymbolsForValidation = ['USDS', 'USDC'].filter(
    symbol =>
      !disallowedForFlow.some(
        disallowedToken => disallowedToken.symbol.toLowerCase() === symbol.toLowerCase()
      )
  );
  const usdcSupported = allowedSymbolsForValidation.includes('USDC');

  const validatedExternalState = getValidatedState(externalWidgetState, allowedSymbolsForValidation);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const [isMaxWithdraw, setMaxWithdraw] = useState(false);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);

  const initialTabIndex = validatedExternalState?.flow === SavingsFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const linguiCtx = useLingui();
  const [originToken, setOriginToken] = useState<Token>(
    tokenForSymbol(validatedExternalState?.token || 'USDS')
  );

  const initialAmount = parseUnits(
    validatedExternalState?.amount || '0',
    getTokenDecimals(originToken, chainId)
  );
  const [amount, setAmount] = useState(initialAmount);
  const debouncedAmount = useDebounce(amount);

  const { data: batchSupported, isLoading: isBatchSupportLoading } = useIsBatchSupported();

  const {
    data: allowance,
    mutate: mutateAllowance,
    isLoading: allowanceLoading
  } = useTokenAllowance({
    chainId,
    contractAddress:
      widgetState.flow === SavingsFlow.SUPPLY ? originToken?.address[chainId] : TOKENS.susds.address[chainId],
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });

  const hasAllowance = !!(allowance && debouncedAmount !== 0n && allowance >= debouncedAmount);
  const shouldUseBatch = !!batchEnabled && !!batchSupported && !hasAllowance;

  const { data: chi } = useReadSsrAuthOracleGetChi();
  const { data: rho } = useReadSsrAuthOracleGetRho();
  const { data: dsr } = useReadSsrAuthOracleGetSsr();

  const [updatedChiForDeposit, setUpdatedChiForDeposit] = useState(0n);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  useEffect(() => {
    setOriginToken(tokenForSymbol(validatedExternalState?.token || 'USDS'));
  }, [validatedExternalState?.token]);

  useEffect(() => {
    if (rho && dsr && chi) {
      const timestamp = Math.floor(Date.now() / 1000);
      const elapsedTimeWithEpoch = BigInt(timestamp) + BigInt(EPOCH_LENGTH) - rho;
      const updatedChi = math.updatedChi(dsr, Number(elapsedTimeWithEpoch), chi);

      setUpdatedChiForDeposit(updatedChi);
    }
  }, [rho, dsr, chi]);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  // Balance of the tokens to be upgraded/reverted
  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    chainId,
    address: address,
    token: originToken.address[chainId]
  });

  const { data: sUsdsBalance, refetch: mutateSUsdsBalance } = useTokenBalance({
    address,
    token: sUsdsL2Address[chainId as keyof typeof sUsdsL2Address],
    chainId
  });

  //used to calculate withdrawAll minOut amount
  const convertedBalance = usePreviewSwapExactIn(sUsdsBalance?.value || 0n, TOKENS.susds, originToken);
  const minAmountOutForWithdrawAll = convertedBalance.value;

  //used to calculate regular withdraw maxIn amount
  const { value: maxAmountInForWithdraw } = usePreviewSwapExactOut(
    debouncedAmount,
    TOKENS.susds,
    originToken
  );

  const amountToApprove =
    widgetState.flow === SavingsFlow.SUPPLY
      ? debouncedAmount
      : widgetState.flow === SavingsFlow.WITHDRAW
        ? isMaxWithdraw
          ? sUsdsBalance?.value
          : maxAmountInForWithdraw
        : undefined;

  const debouncedWadAmount =
    originToken.symbol === 'USDC' ? math.convertUSDCtoWad(debouncedAmount) : debouncedAmount;
  const shares = math.calculateSharesFromAssets(debouncedWadAmount, updatedChiForDeposit);
  const supplyMinAmountOut = originToken.symbol === 'USDC' ? math.roundDownLastTwelveDigits(shares) : shares;

  const {
    savingsApprove,
    savingsSupply,
    batchSavingsSupply,
    savingsWithdraw,
    batchSavingsWithdraw,
    savingsWithdrawAll,
    batchSavingsWithdrawAll
  } = useL2SavingsTransactions({
    amountToApprove,
    allowance,
    originToken,
    amount: debouncedAmount,
    isMaxWithdraw,
    supplyMinAmountOut,
    referralCode,
    sUsdsBalance: sUsdsBalance?.value,
    minAmountOutForWithdrawAll,
    maxAmountInForWithdraw,
    mutateAllowance,
    mutateOriginBalance,
    mutateSUsdsBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const needsAllowance = !!(!allowance || allowance < (amountToApprove || 0n));

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
      setMaxWithdraw(false);
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: tabIndex === 0 ? SavingsFlow.SUPPLY : SavingsFlow.WITHDRAW,
        action: null,
        screen: null
      });
    }
  }, [tabIndex, isConnectedAndEnabled]);

  // If we're in the supply or withdraw flow and we need allowance and  batch transactions are not supported, set the action to approve
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

    if (
      widgetState.flow === SavingsFlow.WITHDRAW &&
      (widgetState.screen === SavingsScreen.ACTION || widgetState.screen === SavingsScreen.REVIEW)
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action:
          needsAllowance && !allowanceLoading && !shouldUseBatch && !isBatchSupportLoading
            ? SavingsAction.APPROVE
            : SavingsAction.WITHDRAW
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
    setShowStepIndicator(true);
  }, []);

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
    (convertedBalance?.value === 0n || !!convertedBalance?.value) &&
    debouncedAmount > convertedBalance?.value &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const isSuccessfulWithdraw =
    widgetState.screen === SavingsScreen.TRANSACTION &&
    widgetState.action === SavingsAction.WITHDRAW &&
    txStatus === TxStatus.SUCCESS;
  const withdrawDisabled =
    // Enable button if we're in transaction screen and status is success
    isSuccessfulWithdraw
      ? false
      : [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
        isWithdrawBalanceError ||
        (isMaxWithdraw ? !savingsWithdrawAll.prepared : !savingsWithdraw.prepared) ||
        isAmountWaitingForDebounce;

  const batchWithdrawDisabled = isSuccessfulWithdraw
    ? false
    : [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
      isWithdrawBalanceError ||
      (isMaxWithdraw ? !batchSavingsWithdrawAll.prepared : !batchSavingsWithdraw.prepared) ||
      isAmountWaitingForDebounce ||
      // If the user has allowance, don't send a batch transaction as it's only 1 contract call
      hasAllowance ||
      allowanceLoading ||
      !batchSupported;

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
    hasAllowance ||
    allowanceLoading ||
    !batchSupported;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    (widgetState.flow === SavingsFlow.SUPPLY && isSupplyBalanceError) ||
    (widgetState.flow === SavingsFlow.WITHDRAW && isWithdrawBalanceError) ||
    !savingsApprove.prepared ||
    savingsApprove.isLoading ||
    (txStatus === TxStatus.SUCCESS &&
      (widgetState.flow === SavingsFlow.SUPPLY
        ? !savingsSupply.prepared
        : isMaxWithdraw
          ? !savingsWithdrawAll.prepared
          : !savingsWithdraw.prepared)) || // disable next button if the following action (supply or withdraw) is not prepared
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
    if (hasAllowance) {
      // If the user has allowance, just send the individual transaction as it will be more gas efficient
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
    const executeFunction = isMaxWithdraw ? savingsWithdrawAll.execute : savingsWithdraw.execute;
    executeFunction();
  };
  const batchWithdrawOnClick = () => {
    if (hasAllowance) {
      // If the user has allowance, just send the individual transaction as it will be more gas efficient
      withdrawOnClick();
      return;
    }
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: SavingsScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    const executeFunction = isMaxWithdraw ? batchSavingsWithdrawAll.execute : batchSavingsWithdraw.execute;
    executeFunction();
  };
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
        ? shouldUseBatch
          ? batchWithdrawOnClick()
          : withdrawOnClick()
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
          : shouldUseBatch
            ? widgetState.flow === SavingsFlow.SUPPLY
              ? batchSupplyOnClick
              : batchWithdrawOnClick
            : (widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.APPROVE) ||
                (widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.APPROVE)
              ? approveOnClick
              : widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.SUPPLY
                ? supplyOnClick
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

  useEffect(() => {
    if (savingsWithdrawAll.prepareError) {
      console.log(savingsWithdrawAll.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: savingsWithdrawAll.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [savingsWithdrawAll.prepareError]);

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
          (widgetState.action === SavingsAction.WITHDRAW &&
            (shouldUseBatch ? batchWithdrawDisabled : withdrawDisabled)) ||
          (widgetState.action === SavingsAction.APPROVE && approveDisabled))
    );
  }, [
    widgetState.action,
    supplyDisabled,
    withdrawDisabled,
    approveDisabled,
    isConnectedAndEnabled,
    shouldUseBatch,
    batchSupplyDisabled,
    batchWithdrawDisabled
  ]);

  // After a successful approval, wait for the next hook (supply, withdraw) to be prepared and send the transaction
  useEffect(() => {
    const nextAction =
      widgetState.flow === SavingsFlow.SUPPLY
        ? savingsSupply
        : isMaxWithdraw
          ? savingsWithdrawAll
          : savingsWithdraw;
    const nextActionOnClick = widgetState.flow === SavingsFlow.SUPPLY ? supplyOnClick : withdrawOnClick;

    if (
      widgetState.action === SavingsAction.APPROVE &&
      txStatus === TxStatus.SUCCESS &&
      nextAction.prepared
    ) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: widgetState.flow === SavingsFlow.SUPPLY ? SavingsAction.SUPPLY : SavingsAction.WITHDRAW
      }));
      nextActionOnClick();
    }
  }, [
    widgetState.flow,
    widgetState.action,
    txStatus,
    savingsSupply.prepared,
    savingsWithdrawAll.prepared,
    savingsWithdraw.prepared,
    isMaxWithdraw
  ]);

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

  const usds = TOKENS.usds;

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setAmount(initialAmount);
    setMaxWithdraw(false);
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);
    setOriginToken(tokenForSymbol(validatedExternalState?.token || 'USDS'));

    // Reset widget state to initial screen
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
          {usdcSupported ? (
            <Trans>Use USDS or USDC to access the Sky Savings Rate</Trans>
          ) : (
            <Trans>Use USDS to access the Sky Savings Rate</Trans>
          )}
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
        {originToken && txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <SavingsTransactionStatus
              originToken={originToken}
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
              originToken={originToken}
              originAmount={debouncedAmount}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <L2SavingsSupplyWithdraw
              leftTabTitle={t`Supply`}
              rightTabTitle={t`Withdraw`}
              originAmount={debouncedAmount}
              originBalance={originBalance?.value || 0n}
              originOptions={calculateOriginOptions(
                usds,
                widgetState.action,
                tabIndex === 0 ? SavingsFlow.SUPPLY : SavingsFlow.WITHDRAW,
                defaultDepositOptions,
                defaultWithdrawOptions,
                disallowedTokens
              )}
              originToken={originToken}
              convertedBalance={convertedBalance}
              tabIndex={tabIndex}
              onToggle={index => {
                setTabIndex(index);
                setAmount(0n);
              }}
              onOriginInputChange={(newValue, userTriggered) => {
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
              enabled={enabled}
              onExternalLinkClicked={onExternalLinkClicked}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onMenuItemChange={(op: Token | null) => {
                if (op) {
                  setOriginToken(op as Token);
                  onWidgetStateChange?.({ originToken: op.symbol, txStatus, widgetState });
                }
              }}
              error={widgetState.flow === SavingsFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError}
              setMaxWithdraw={setMaxWithdraw}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const L2SavingsWidget = withWidgetProvider(SavingsWidgetWrapped, 'L2SavingsWidget');
