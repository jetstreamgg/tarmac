import {
  psm3L2Address,
  sUsdsL2Address,
  Token,
  TOKENS,
  useApproveToken,
  usePsmSwapExactIn,
  usePsmSwapExactOut,
  useTokenAllowance,
  useTokenBalance,
  getTokenDecimals
} from '@jetstreamgg/sky-hooks';
import { getTransactionLink, useDebounce, formatBigInt, math, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { SavingsFlow, SavingsAction, SavingsScreen } from '../SavingsWidget/lib/constants';
import { SavingsTransactionStatus } from '../SavingsWidget/components/SavingsTransactionStatus';
import { L2SavingsSupplyWithdraw } from './components/L2SavingsSupplyWithdraw';
import { WidgetContext, WidgetProvider } from '@widgets/context/WidgetContext';
import { NotificationType, TxStatus, EPOCH_LENGTH } from '@widgets/shared/constants';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { getValidatedState } from '@widgets/lib/utils';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { usePreviewSwapExactIn, usePreviewSwapExactOut } from '@jetstreamgg/sky-hooks';
import {
  useReadSsrAuthOracleGetChi,
  useReadSsrAuthOracleGetRho,
  useReadSsrAuthOracleGetSsr
} from '@jetstreamgg/sky-hooks';

const defaultDepositOptions = [TOKENS.usds, TOKENS.usdc];
const defaultWithdrawOptions = [TOKENS.usds, TOKENS.usdc];

function calculateOriginOptions(
  token: Token,
  action: string,
  flow: SavingsFlow,
  depositOptions: Token[] = [],
  withdrawOptions: Token[] = [],
  disallowedTokens: { [key in SavingsFlow]: Token[] } = {
    [SavingsFlow.SUPPLY]: [],
    [SavingsFlow.WITHDRAW]: []
  }
) {
  const options = action === 'deposit' ? [...depositOptions] : [...withdrawOptions];
  const disallowed = disallowedTokens[flow];
  const allowedOptions = options.filter(option => !disallowed.includes(option));

  // Sort the array so that the selected token is first
  allowedOptions.sort((a, b) => {
    if (a.symbol === token.symbol) {
      return -1;
    }
    if (b.symbol === token.symbol) {
      return 1;
    }
    return 0;
  });

  return allowedOptions;
}

const tokenForSymbol = (symbol: keyof typeof TOKENS) => {
  return TOKENS[(symbol as string).toLowerCase()];
};

export type SavingsWidgetProps = WidgetProps & {
  disallowedTokens?: { [key in SavingsFlow]: Token[] };
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const L2SavingsWidget = ({
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
  disallowedTokens,
  shouldReset = false
}: SavingsWidgetProps) => {
  const key = shouldReset ? 'reset' : undefined;
  return (
    <ErrorBoundary componentName="SavingsWidget">
      <WidgetProvider key={key} locale={locale}>
        <SavingsWidgetWrapped
          key={key}
          onConnect={onConnect}
          addRecentTransaction={addRecentTransaction}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          onNotification={onNotification}
          onWidgetStateChange={shouldReset ? undefined : onWidgetStateChange}
          onExternalLinkClicked={onExternalLinkClicked}
          locale={locale}
          enabled={enabled}
          referralCode={referralCode}
          disallowedTokens={disallowedTokens}
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
  locale,
  enabled = true,
  referralCode,
  disallowedTokens
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

  const validatedExternalState = getValidatedState(externalWidgetState, allowedSymbolsForValidation);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const [isMaxWithdraw, setMaxWithdraw] = useState(false);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useAccount();
  const isSafeWallet = useIsSafeWallet();
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

  const savingsApprove = useApproveToken({
    amount: amountToApprove,
    contractAddress:
      widgetState.flow === SavingsFlow.SUPPLY ? originToken.address[chainId] : TOKENS.susds.address[chainId],
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address],
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateOriginBalance();
      mutateSUsdsBalance();

      const retryFunction =
        widgetState.flow === SavingsFlow.SUPPLY
          ? savingsSupply.retryPrepare
          : isMaxWithdraw
            ? savingsWithdrawAll.retryPrepare
            : savingsWithdraw.retryPrepare;
      retryFunction();

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

  const debouncedWadAmount =
    originToken.symbol === 'USDC' ? math.convertUSDCtoWad(debouncedAmount) : debouncedAmount;
  const shares = math.calculateSharesFromAssets(debouncedWadAmount, updatedChiForDeposit);
  const supplyMinAmountOut = originToken.symbol === 'USDC' ? math.roundDownLastTwelveDigits(shares) : shares;

  const savingsSupply = usePsmSwapExactIn({
    amountIn: debouncedAmount,
    assetIn: originToken.address[chainId],
    assetOut: TOKENS.susds.address[chainId],
    minAmountOut: supplyMinAmountOut,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Supplying ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Supply successful`,
        description: t`You supplied ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateOriginBalance();
      mutateSUsdsBalance();
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
      mutateOriginBalance();
      mutateSUsdsBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    enabled: widgetState.action === SavingsAction.SUPPLY && allowance !== undefined && supplyMinAmountOut > 0n
  });

  // use this to withdraw all from savings
  const savingsWithdrawAll = usePsmSwapExactIn({
    amountIn: sUsdsBalance?.value || 0n,
    assetIn: TOKENS.susds.address[chainId],
    assetOut: originToken.address[chainId],
    minAmountOut: minAmountOutForWithdrawAll,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Withdrawing ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Withdraw successful`,
        description: t`You withdrew ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateOriginBalance();
      mutateSUsdsBalance();
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
      mutateOriginBalance();
      mutateSUsdsBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW ||
        (widgetState.action === SavingsAction.APPROVE && txStatus === TxStatus.SUCCESS)) &&
      isMaxWithdraw &&
      allowance !== undefined
  });

  // use this to withdraw a specific amount from savings
  const savingsWithdraw = usePsmSwapExactOut({
    amountOut: debouncedAmount,
    assetOut: originToken.address[chainId],
    assetIn: TOKENS.susds.address[chainId],
    maxAmountIn: maxAmountInForWithdraw,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Withdrawing ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: hash => {
      onNotification?.({
        title: t`Withdraw successful`,
        description: t`You withdrew ${formatBigInt(debouncedAmount, {
          locale,
          unit: originToken && getTokenDecimals(originToken, chainId)
        })} ${originToken.symbol}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      mutateOriginBalance();
      mutateSUsdsBalance();
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
      mutateOriginBalance();
      mutateSUsdsBalance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW ||
        (widgetState.action === SavingsAction.APPROVE && txStatus === TxStatus.SUCCESS)) &&
      !isMaxWithdraw &&
      allowance !== undefined
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

  // If we're in the supply or withdraw flow and we need allowance, set the action to approve,
  useEffect(() => {
    if (widgetState.flow === SavingsFlow.SUPPLY && widgetState.screen === SavingsScreen.ACTION) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: needsAllowance && !allowanceLoading ? SavingsAction.APPROVE : SavingsAction.SUPPLY
      }));
    }

    if (widgetState.flow === SavingsFlow.WITHDRAW && widgetState.screen === SavingsScreen.ACTION) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: needsAllowance && !allowanceLoading ? SavingsAction.APPROVE : SavingsAction.WITHDRAW
      }));
    }
  }, [widgetState.flow, widgetState.screen, needsAllowance, allowanceLoading]);

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

  const supplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    allowance === undefined ||
    !savingsSupply.prepared ||
    savingsSupply.isLoading ||
    isAmountWaitingForDebounce;

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
    const executeFunction = isMaxWithdraw ? savingsWithdrawAll.execute : savingsWithdraw.execute;
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
      ? supplyOnClick()
      : widgetState.action === SavingsAction.WITHDRAW
        ? withdrawOnClick()
        : widgetState.action === SavingsAction.APPROVE
          ? approveOnClick()
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
          ? errorOnClick
          : (widgetState.flow === SavingsFlow.SUPPLY && widgetState.action === SavingsAction.APPROVE) ||
              (widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.APPROVE)
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
      if (
        (widgetState.flow === SavingsFlow.SUPPLY &&
          widgetState.action === SavingsAction.APPROVE &&
          txStatus === TxStatus.SUCCESS) ||
        (widgetState.flow === SavingsFlow.WITHDRAW &&
          widgetState.action === SavingsAction.APPROVE &&
          txStatus === TxStatus.SUCCESS)
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
      } else if (widgetState.flow === SavingsFlow.WITHDRAW && widgetState.action === SavingsAction.APPROVE) {
        setButtonText(t`Approve withdraw amount`);
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
