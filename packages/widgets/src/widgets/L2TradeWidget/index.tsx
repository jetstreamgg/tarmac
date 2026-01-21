import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  useTokenBalance,
  TokenForChain,
  getTokenDecimals,
  useTokenAllowance,
  psm3L2Address,
  Token,
  useReadSsrAuthOracleGetChi,
  useReadSsrAuthOracleGetRho,
  useReadSsrAuthOracleGetSsr,
  useIsBatchSupported
} from '@jetstreamgg/sky-hooks';
import { useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { formatBigInt, formatNumber, math, useDebounce } from '@jetstreamgg/sky-utils';
import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { TxStatus, EPOCH_LENGTH } from '@widgets/shared/constants';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { SUPPORTED_TOKEN_SYMBOLS, TradeAction, TradeFlow, TradeScreen, TradeSide } from '@widgets/index';
import { getAllowedTargetTokens } from '../TradeWidget/lib/utils';
import { defaultConfig } from '@widgets/config/default-config';
import { useLingui } from '@lingui/react';
import { formatUnits, parseUnits } from 'viem';
import { getValidatedState } from '@widgets/lib/utils';
import { L2TradeInputs } from './components/L2TradeInputs';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { useAddTokenToWallet } from '@widgets/shared/hooks/useAddTokenToWallet';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { L2TradeTransactionStatus } from './components/L2TradeTransactionStatus';
import { useTokenImage } from '@widgets/shared/hooks/useTokenImage';
import { L2TradeTransactionReview } from './components/L2TradeTransactionReview';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useL2TradeTransactions } from './hooks/useL2TradeTransactions';
import { useMaxInForWithdraw } from './hooks/useMaxInForWithdraw';
import { useMaxOutForDeposit } from './hooks/useMaxOutForDeposit';
import { Trans } from '@lingui/react/macro';
import { getTooltipById } from '../../data/tooltips';

export type TradeWidgetProps = WidgetProps & {
  customTokenList?: TokenForChain[];
  disallowedPairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  widgetTitle?: ReactNode;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  tokensLocked?: boolean;
};

function TradeWidgetWrapped({
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  customTokenList = [],
  disallowedPairs = defaultConfig.tradeDisallowedPairs,
  locale,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onCustomNavigation,
  customNavigationLabel,
  onExternalLinkClicked,
  enabled = true,
  legalBatchTxUrl,
  referralCode,
  widgetTitle,
  batchEnabled,
  setBatchEnabled,
  tokensLocked = false
}: TradeWidgetProps): React.ReactElement {
  const { mutate: addToWallet } = useAddTokenToWallet();
  const [showAddToken, setShowAddToken] = useState(false);
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const [lastUpdated, setLastUpdated] = useState<TradeSide>(TradeSide.IN);

  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const linguiCtx = useLingui();

  const { data: chi } = useReadSsrAuthOracleGetChi();
  const { data: rho } = useReadSsrAuthOracleGetRho();
  const { data: dsr } = useReadSsrAuthOracleGetSsr();

  const [updatedChiForDeposit, setUpdatedChiForDeposit] = useState(0n);

  const tokenList = useMemo(() => {
    const configOriginList = defaultConfig.tradeTokenList[chainId];
    const tokenListToUse = customTokenList.length ? customTokenList : configOriginList;
    const seen = new Set<string>();
    const uniqueTokens = tokenListToUse.filter(token => {
      const duplicate = seen.has(token.symbol);
      if (token.symbol) {
        seen.add(token.symbol);
      }
      return !duplicate;
    });
    return uniqueTokens;
  }, [customTokenList, chainId, defaultConfig.tradeTokenList]);

  const originTokenList = useMemo(() => {
    // We don't include the token if it has no pairs
    return tokenList.filter(
      token => getAllowedTargetTokens(token.symbol, tokenList, disallowedPairs).length > 0
    );
  }, [tokenList, disallowedPairs]);

  const initialOriginTokenIndex = 0;
  const initialOriginToken =
    originTokenList.find(
      token => token.symbol.toLowerCase() === validatedExternalState?.token?.toLowerCase()
    ) || (originTokenList.length ? originTokenList[initialOriginTokenIndex] : undefined);

  const [originToken, setOriginToken] = useState<TokenForChain | undefined>(initialOriginToken);

  const targetTokenList = useMemo(() => {
    return getAllowedTargetTokens(originToken?.symbol || '', tokenList, disallowedPairs);
  }, [originToken?.symbol, tokenList, disallowedPairs]);

  const initialTargetToken = targetTokenList.find(
    token =>
      token.symbol.toLowerCase() === validatedExternalState?.targetToken?.toLowerCase() &&
      token.symbol !== originToken?.symbol
  );
  const [targetToken, setTargetToken] = useState<TokenForChain | undefined>(initialTargetToken);

  const initialOriginAmount = parseUnits(
    validatedExternalState?.amount || '0',
    getTokenDecimals(originToken, chainId)
  );

  const [originAmount, setOriginAmount] = useState(initialOriginAmount);
  const debouncedOriginAmount = useDebounce(originAmount);

  const initialTargetAmount = parseUnits(
    validatedExternalState?.amount || '0',
    getTokenDecimals(targetToken, chainId)
  );

  const [targetAmount, setTargetAmount] = useState(initialTargetAmount);
  const debouncedTargetAmount = useDebounce(targetAmount);

  const { data: batchSupported } = useIsBatchSupported();

  const { value: maxAmountInForWithdraw } = useMaxInForWithdraw(
    debouncedTargetAmount,
    originToken,
    targetToken
  );

  const { value: maxAmountOutForDeposit } = useMaxOutForDeposit(
    debouncedOriginAmount,
    originToken,
    targetToken
  );

  const originTokenAddress = originToken?.address;
  const targetTokenAddress = targetToken?.address;

  const {
    setButtonText,
    setIsLoading,
    setIsDisabled,
    setTxStatus,
    setExternalLink,
    txStatus,
    widgetState,
    setWidgetState,
    setBackButtonText,
    setShowStepIndicator
  } = useContext(WidgetContext);

  const pairValid = !!originToken && !!targetToken && originToken.symbol !== targetToken.symbol;

  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    address,
    token: originTokenAddress,
    chainId
  });

  const isBalanceError = Boolean(
    txStatus === TxStatus.IDLE &&
      originBalance &&
      debouncedOriginAmount > originBalance.value &&
      originAmount !== 0n
  );

  const { data: targetBalance, refetch: mutateTargetBalance } = useTokenBalance({
    address,
    token: targetTokenAddress,
    chainId
  });

  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId,
    contractAddress: originToken?.address as `0x${string}`,
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });

  const needsAllowance = !!(!allowance || allowance < debouncedOriginAmount);
  const shouldUseBatch = !!batchEnabled && !!batchSupported && needsAllowance;
  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(needsAllowance);
    }
  }, [txStatus, needsAllowance, setShowStepIndicator]);

  useEffect(() => {
    if (rho && dsr && chi) {
      const timestamp = Math.floor(Date.now() / 1000);
      const elapsedTimeWithEpoch = BigInt(timestamp) + BigInt(EPOCH_LENGTH) - rho;
      const updatedChi = math.updatedChi(dsr, Number(elapsedTimeWithEpoch), chi);

      setUpdatedChiForDeposit(updatedChi);
    }
  }, [rho, dsr, chi]);

  useEffect(() => {
    const bothAmountsZero = originAmount === 0n && targetAmount === 0n;
    const bothDebouncedNonZero = debouncedOriginAmount !== 0n && debouncedTargetAmount !== 0n;

    // Skip calculations ONLY if:
    // - Both current amounts are 0 (just cleared by switch)
    // - AND both debounced values are still non-zero (haven't caught up yet)
    // This specifically detects a switch operation
    if (bothAmountsZero && bothDebouncedNonZero) {
      return;
    }

    if (lastUpdated === TradeSide.IN) {
      // If origin is 0, clear target immediately
      if (debouncedOriginAmount === 0n) {
        setTargetAmount(0n);
        return;
      }

      // stables <-> stables
      if (
        originToken?.symbol === 'USDS' &&
        targetToken?.symbol === 'USDC' &&
        maxAmountOutForDeposit !== undefined &&
        maxAmountOutForDeposit !== 0n
      ) {
        setTargetAmount(maxAmountOutForDeposit);
      }
      if (
        originToken?.symbol === 'USDC' &&
        targetToken?.symbol === 'USDS' &&
        maxAmountOutForDeposit !== undefined &&
        maxAmountOutForDeposit !== 0n
      ) {
        setTargetAmount(maxAmountOutForDeposit);
      }

      // stables -> sUSDS
      if (originToken?.symbol === 'USDS' && targetToken?.symbol === 'sUSDS') {
        const calculated = math.calculateSharesFromAssets(debouncedOriginAmount, updatedChiForDeposit);
        setTargetAmount(calculated);
      }

      if (originToken?.symbol === 'USDC' && targetToken?.symbol === 'sUSDS') {
        const calculated = math.roundDownLastTwelveDigits(
          math.calculateSharesFromAssets(math.convertUSDCtoWad(debouncedOriginAmount), updatedChiForDeposit)
        );
        setTargetAmount(calculated);
      }

      // sUSDS -> stables
      if (
        originToken?.symbol === 'sUSDS' &&
        targetToken?.symbol === 'USDS' &&
        maxAmountOutForDeposit !== undefined &&
        maxAmountOutForDeposit !== 0n
      ) {
        setTargetAmount(maxAmountOutForDeposit);
      }
      if (
        originToken?.symbol === 'sUSDS' &&
        targetToken?.symbol === 'USDC' &&
        maxAmountOutForDeposit !== undefined &&
        maxAmountOutForDeposit !== 0n
      ) {
        setTargetAmount(maxAmountOutForDeposit);
      }
    }

    if (lastUpdated === TradeSide.OUT) {
      // If target is 0, clear origin immediately
      if (debouncedTargetAmount === 0n) {
        setOriginAmount(0n);
        return;
      }
      // stables <-> stables
      if (
        originToken?.symbol === 'USDS' &&
        targetToken?.symbol === 'USDC' &&
        maxAmountInForWithdraw !== undefined &&
        maxAmountInForWithdraw !== 0n
      ) {
        setOriginAmount(maxAmountInForWithdraw);
      }
      if (
        originToken?.symbol === 'USDC' &&
        targetToken?.symbol === 'USDS' &&
        maxAmountInForWithdraw !== undefined &&
        maxAmountInForWithdraw !== 0n
      ) {
        setOriginAmount(maxAmountInForWithdraw);
      }

      // stables -> sUSDS
      if (originToken?.symbol === 'USDS' && targetToken?.symbol === 'sUSDS')
        setOriginAmount(math.calculateAssetsFromShares(debouncedTargetAmount, updatedChiForDeposit));

      if (originToken?.symbol === 'USDC' && targetToken?.symbol === 'sUSDS')
        setOriginAmount(
          math.roundUpLastTwelveDigits(
            math.convertWadtoUSDC(math.calculateAssetsFromShares(debouncedTargetAmount, updatedChiForDeposit))
          )
        );

      // sUSDS -> stables
      if (
        originToken?.symbol === 'sUSDS' &&
        targetToken?.symbol === 'USDS' &&
        maxAmountInForWithdraw !== undefined &&
        maxAmountInForWithdraw !== 0n
      ) {
        setOriginAmount(maxAmountInForWithdraw);
      }
      if (
        originToken?.symbol === 'sUSDS' &&
        targetToken?.symbol === 'USDC' &&
        maxAmountInForWithdraw !== undefined &&
        maxAmountInForWithdraw !== 0n
      ) {
        setOriginAmount(maxAmountInForWithdraw);
      }
      if (originToken) {
        const formattedValue = formatUnits(originAmount, getTokenDecimals(originToken, chainId));
        onWidgetStateChange?.({
          originAmount: formattedValue,
          txStatus,
          widgetState
        });
      }
    }
  }, [
    originToken,
    debouncedOriginAmount,
    targetToken,
    debouncedTargetAmount,
    lastUpdated,
    updatedChiForDeposit,
    maxAmountOutForDeposit,
    maxAmountInForWithdraw
  ]);

  useEffect(() => {
    const tokensHasChanged =
      externalWidgetState?.token?.toLowerCase() !== originToken?.symbol?.toLowerCase() ||
      externalWidgetState?.targetToken?.toLowerCase() !== targetToken?.symbol?.toLowerCase();

    const amountHasChanged =
      externalWidgetState?.amount !== undefined &&
      externalWidgetState?.amount !==
        formatBigInt(originAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        });

    if ((tokensHasChanged || amountHasChanged) && txStatus === TxStatus.IDLE) {
      // Handle "Trade to X" case
      if (externalWidgetState?.targetToken && !externalWidgetState?.token) {
        const proposedTargetToken = tokenList.find(
          token => token.symbol.toLowerCase() === externalWidgetState.targetToken?.toLowerCase()
        );

        if (proposedTargetToken) {
          // Check if current origin token would create an invalid pair
          const isInvalidPair =
            originToken &&
            // Same token check
            (originToken.symbol.toLowerCase() === proposedTargetToken.symbol.toLowerCase() ||
              // Disallowed pair check (like ETH-WETH)
              ((disallowedPairs || {})[originToken.symbol] &&
                (disallowedPairs || {})[originToken.symbol].includes(
                  proposedTargetToken.symbol as SUPPORTED_TOKEN_SYMBOLS
                )));

          if (isInvalidPair) {
            // If invalid pair, clear target token but keep origin
            setTargetToken(undefined);
            setTargetAmount(0n);
          } else if (originToken) {
            // We have a valid origin token, check if target is allowed
            const newTargetList = getAllowedTargetTokens(originToken.symbol, tokenList, disallowedPairs);

            // If target token is not in allowed list, don't set it
            if (!newTargetList.find(t => t.symbol === proposedTargetToken.symbol)) {
              setTargetToken(undefined);
            } else {
              setTargetToken(proposedTargetToken);
            }
            // Keep origin amount but reset target amount
            setTargetAmount(0n);
          }
        }
      } else {
        // Handle other cases (normal trade with source token)
        const newOriginToken = tokenList.find(
          token => token.symbol.toLowerCase() === externalWidgetState?.token?.toLowerCase()
        );

        if (newOriginToken) {
          setOriginToken(newOriginToken);

          // Handle target token changes
          if (externalWidgetState?.targetToken) {
            // Get allowed target tokens for this origin
            const newTargetList = getAllowedTargetTokens(newOriginToken.symbol, tokenList, disallowedPairs);
            const newTargetToken = newTargetList.find(
              token => token.symbol.toLowerCase() === externalWidgetState.targetToken?.toLowerCase()
            );

            // Only clear target if it's the same as origin, otherwise set the new target
            if (newOriginToken.symbol.toLowerCase() === externalWidgetState.targetToken?.toLowerCase()) {
              setTargetToken(undefined);
            } else {
              setTargetToken(newTargetToken || undefined);
            }
          } else {
            // If no target token in external state, clear it
            setTargetToken(undefined);
          }
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      // Handle amount updates
      if (externalWidgetState?.amount !== undefined) {
        const newOriginToken = tokenList.find(
          token => token.symbol.toLowerCase() === externalWidgetState?.token?.toLowerCase()
        );
        if (amountHasChanged && newOriginToken !== undefined) {
          const newAmount = parseUnits(externalWidgetState.amount, getTokenDecimals(newOriginToken, chainId));

          // Only update if the amount has actually changed
          if (newAmount !== originAmount) {
            timeoutId = setTimeout(() => {
              // Batch all state updates together
              setOriginAmount(newAmount);
              // setTargetAmount(0n);
              setLastUpdated(TradeSide.IN);
            }, 500);
          }
        }
      } else {
        setOriginAmount(0n);
        setTargetAmount(0n);
      }

      // Cleanup the timeout if the component unmounts or dependencies change
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [
    externalWidgetState?.timestamp,
    externalWidgetState?.amount,
    externalWidgetState?.token,
    externalWidgetState?.targetToken,
    txStatus
  ]);

  // Update external widget state when the debounced origin amount is updated
  useEffect(() => {
    if (originToken) {
      // Convert 0n to empty string to properly clear URL params
      const formattedValue =
        debouncedOriginAmount === 0n
          ? ''
          : formatUnits(debouncedOriginAmount, getTokenDecimals(originToken, chainId));
      if (formattedValue !== externalWidgetState?.amount) {
        onWidgetStateChange?.({
          originAmount: formattedValue,
          originToken: originToken?.symbol,
          targetToken: targetToken?.symbol,
          txStatus,
          widgetState
        });
      }
    }
  }, [debouncedOriginAmount]);

  const { batchTrade, batchTradeOut } = useL2TradeTransactions({
    originAmount: debouncedOriginAmount,
    originToken,
    targetToken,
    targetAmount: debouncedTargetAmount,
    referralCode,
    maxAmountInForWithdraw,
    shouldUseBatch,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    mutateAllowance,
    mutateOriginBalance,
    mutateTargetBalance,
    setShowAddToken
  });

  const isAmountWaitingForDebounce =
    lastUpdated === TradeSide.IN
      ? debouncedOriginAmount !== originAmount
      : debouncedTargetAmount !== targetAmount;

  const tradeDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isBalanceError ||
    !pairValid ||
    (lastUpdated === TradeSide.OUT ? !batchTradeOut.prepared : !batchTrade.prepared) ||
    isAmountWaitingForDebounce;

  useEffect(() => {
    if (isConnectedAndEnabled) {
      //Initialize the trade flow
      setWidgetState({
        flow: TradeFlow.TRADE,
        action: TradeAction.TRADE,
        screen: TradeScreen.ACTION
      });
    } else {
      // Reset widget state when we are not connected
      setWidgetState({
        flow: null,
        action: null,
        screen: null
      });
    }
  }, [isConnectedAndEnabled]);

  // Update button state according to action and tx
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS) {
        if (showAddToken) {
          setButtonText(t`Add ${targetToken?.symbol || ''} to wallet`);
          // This should run after adding the token
        } else if (customNavigationLabel && !showAddToken) {
          setButtonText(customNavigationLabel);
        } else {
          setButtonText(t`Back to Trade`);
        }
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === TradeScreen.ACTION) {
        if (!targetToken) {
          setButtonText(t`Select a token`);
        } else if (originAmount === 0n) {
          setButtonText(t`Enter amount`);
        } else {
          setButtonText(t`Review`);
        }
      } else if (widgetState.screen === TradeScreen.REVIEW) {
        if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else {
          setButtonText(t`Confirm trade`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    txStatus,
    isConnectedAndEnabled,
    customNavigationLabel,
    originAmount,
    linguiCtx,
    widgetState,
    chainId,
    targetToken,
    showAddToken,
    shouldUseBatch,
    needsAllowance
  ]);

  // set widget button to be disabled depending on which action we're performing
  useEffect(() => {
    setIsDisabled(isConnectedAndEnabled && tradeDisabled);
  }, [isConnectedAndEnabled, setIsDisabled, tradeDisabled]);

  // set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus]);

  useEffect(() => {
    setOriginToken(initialOriginToken);
  }, [chainId, initialOriginTokenIndex]);

  useEffect(() => {
    if (targetTokenList.length === 1) {
      // Theres only one token in the list, we select it
      setTargetToken(targetTokenList[0]);
    } else if (!targetTokenList.find(iterable => iterable.symbol === targetToken?.symbol)) {
      // if current target token isn't in the list, set to undefined
      setTargetToken(undefined);
    }
    // do nothing, the current target token is correct
  }, [targetTokenList]);

  useEffect(() => {
    if (targetToken === undefined || originToken === undefined) {
      onWidgetStateChange?.({
        targetToken: targetToken ? targetToken.symbol : '',
        originToken: originToken ? originToken.symbol : '',
        txStatus,
        widgetState
      });
    }
  }, [targetToken, originToken]);

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setOriginAmount(initialOriginAmount);
    setTargetAmount(initialTargetAmount);
    setLastUpdated(TradeSide.IN);
    setOriginToken(initialOriginToken);
    setTargetToken(initialTargetToken);
    setTxStatus(TxStatus.IDLE);
    setShowAddToken(false);
    setExternalLink(undefined);

    // Reset widget state to initial screen
    setWidgetState({
      flow: TradeFlow.TRADE,
      action: TradeAction.TRADE,
      screen: TradeScreen.ACTION
    });
  }, [chainId]);

  const tradeOnClick = () => {
    const executeFunction = lastUpdated === TradeSide.OUT ? batchTradeOut.execute : batchTrade.execute;
    executeFunction();
  };

  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);

    setTimeout(() => {
      setOriginAmount(0n);
      setTargetAmount(0n);
      setOriginToken(initialOriginToken);
      setTargetToken(undefined);
    }, 500);

    // Notify widget state change to clear URL params and force a reset
    onWidgetStateChange?.({
      originToken: initialOriginToken?.symbol || '',
      targetToken: '',
      originAmount: '',
      txStatus: TxStatus.IDLE,
      widgetState: {
        flow: TradeFlow.TRADE,
        action: TradeAction.TRADE,
        screen: TradeScreen.ACTION
      },
      hash: undefined // Clear any existing hash
    });

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: TradeAction.TRADE,
      screen: TradeScreen.ACTION
    }));
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: TradeScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    if (txStatus === TxStatus.SUCCESS) {
      // If success trade we restart the flow
      setBackButtonText(t`Back`);
      nextOnClick();
    } else {
      setTxStatus(TxStatus.IDLE);
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        screen: TradeScreen.ACTION
      }));
    }
  };

  const baseUrl = window.location.origin;
  const imgSrc = useTokenImage(targetToken?.symbol || '');

  const onAddToken = () => {
    if (targetToken && targetToken?.symbol && targetToken?.address) {
      // add currency to wallet
      addToWallet({
        type: 'ERC20',
        options: {
          address: targetToken.address,
          decimals: getTokenDecimals(targetToken, chainId),
          symbol: targetToken.symbol,
          ...(baseUrl && imgSrc && { image: `${baseUrl}/${imgSrc}` })
        }
      });

      // If we have a custom navigation label, leave the state as-is to proceed with custom navigation
      if (!customNavigationLabel) {
        // clear inputs and reset tx and widget state
        setTimeout(() => {
          setOriginAmount(0n);
          setTargetAmount(0n);
          setOriginToken(initialOriginToken);
          setTargetToken(undefined);
          setTxStatus(TxStatus.IDLE);
          setWidgetState({
            flow: TradeFlow.TRADE,
            action: TradeAction.TRADE,
            screen: TradeScreen.ACTION
          });
        }, 500);

        // Notify widget state change to clear URL params and force a reset
        onWidgetStateChange?.({
          originToken: initialOriginToken?.symbol || '',
          targetToken: '',
          originAmount: '',
          txStatus: TxStatus.IDLE,
          widgetState: {
            flow: TradeFlow.TRADE,
            action: TradeAction.TRADE,
            screen: TradeScreen.ACTION
          },
          hash: undefined // Clear any existing hash
        });
      }
      setShowAddToken(false);
    }
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : widgetState.action === TradeAction.TRADE && txStatus === TxStatus.SUCCESS && showAddToken
      ? onAddToken
      : txStatus === TxStatus.SUCCESS && customNavigationLabel
        ? onCustomNavigation
        : txStatus === TxStatus.SUCCESS
          ? nextOnClick
          : txStatus === TxStatus.ERROR
            ? tradeOnClick
            : widgetState.screen === TradeScreen.ACTION
              ? reviewOnClick
              : widgetState.flow === TradeFlow.TRADE
                ? tradeOnClick
                : undefined;

  const showSecondaryButton =
    !!customNavigationLabel ||
    txStatus === TxStatus.ERROR ||
    (widgetState.action === TradeAction.TRADE && txStatus === TxStatus.SUCCESS) ||
    widgetState.screen === TradeScreen.REVIEW;

  return (
    <WidgetContainer
      header={<Heading variant="x-large">{widgetTitle || 'Trade'}</Heading>}
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Trade popular tokens for Sky Ecosystem tokens</Trans>
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
        {originToken && targetToken && txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <L2TradeTransactionStatus
              originToken={originToken as Token}
              originAmount={originAmount}
              targetToken={targetToken as Token}
              targetAmount={targetAmount}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : widgetState.screen === TradeScreen.REVIEW ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <L2TradeTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              originToken={originToken as Token}
              originAmount={debouncedOriginAmount}
              targetToken={targetToken as Token}
              targetAmount={debouncedTargetAmount}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <L2TradeInputs
              setOriginAmount={setOriginAmount}
              onOriginInputChange={(newValue: bigint) => {
                setOriginAmount(newValue);
              }}
              onOriginInputInput={() => {
                setLastUpdated(TradeSide.IN);
              }}
              onOriginTokenChange={(token: TokenForChain) => {
                onWidgetStateChange?.({
                  originToken: token.symbol,
                  txStatus,
                  widgetState
                });
              }}
              originAmount={originAmount}
              originBalance={originBalance}
              originToken={originToken}
              targetBalance={targetToken ? targetBalance : undefined}
              targetToken={targetToken}
              setOriginToken={setOriginToken}
              setTargetToken={setTargetToken}
              setTargetAmount={setTargetAmount}
              onTargetInputChange={newValue => {
                setTargetAmount(newValue);
              }}
              onTargetInputInput={() => {
                setLastUpdated(TradeSide.OUT);
              }}
              onTargetTokenChange={(token: TokenForChain) => {
                onWidgetStateChange?.({
                  targetToken: token.symbol,
                  txStatus,
                  widgetState
                });
              }}
              onUserSwitchTokens={(originSymbol, targetSymbol) => {
                setLastUpdated(TradeSide.IN);
                onWidgetStateChange?.({
                  originToken: originSymbol,
                  targetToken: targetSymbol,
                  originAmount: '',
                  txStatus,
                  widgetState
                });
              }}
              lastUpdated={lastUpdated}
              targetAmount={targetAmount}
              originTokenList={tokensLocked && originToken ? [originToken] : originTokenList}
              targetTokenList={tokensLocked && targetToken ? [targetToken] : targetTokenList}
              isBalanceError={isBalanceError}
              canSwitchTokens={!tokensLocked}
              tokensLocked={tokensLocked}
              isConnectedAndEnabled={isConnectedAndEnabled}
            />
            {!!originAmount && !!targetAmount && !isBalanceError && (
              <TransactionOverview
                title={t`Transaction overview`}
                isFetching={false}
                fetchingMessage={t`Fetching transaction details`}
                transactionData={[
                  {
                    label: t`Exchange Rate`,
                    tooltipTitle: getTooltipById('exchange-rate')?.title || '',
                    tooltipText: getTooltipById('exchange-rate')?.tooltip || '',
                    value: (() => {
                      if (
                        !originAmount ||
                        originAmount === 0n ||
                        !targetAmount ||
                        !originToken ||
                        !targetToken
                      ) {
                        return '1:1';
                      }

                      const originDecimals = getTokenDecimals(originToken, chainId);
                      const targetDecimals = getTokenDecimals(targetToken, chainId);

                      // Convert to decimal values
                      const originValue = Number(formatUnits(originAmount, originDecimals));
                      const targetValue = Number(formatUnits(targetAmount, targetDecimals));

                      // Calculate ratio (how much target you get for 1 origin)
                      const ratio = targetValue / originValue;

                      // Format the ratio - always show as 1:X
                      const formattedRatio = formatNumber(ratio, {
                        maxDecimals: ratio < 0.01 ? 6 : ratio < 1 ? 4 : 2,
                        useGrouping: false
                      });

                      return `1:${formattedRatio}`;
                    })()
                  },
                  {
                    label: t`Tokens to receive`,
                    value: targetToken
                      ? `${formatBigInt(targetAmount, {
                          unit: getTokenDecimals(targetToken, chainId),
                          compact: true
                        })} ${targetToken.symbol}`
                      : '--'
                  },
                  {
                    label: t`Your wallet ${originToken?.symbol || ''} balance`,
                    value:
                      originBalance?.value !== undefined && originAmount > 0n && originToken
                        ? [
                            formatBigInt(originBalance.value, {
                              unit: getTokenDecimals(originToken, chainId),
                              compact: true
                            }),
                            formatBigInt(originBalance.value - originAmount, {
                              unit: getTokenDecimals(originToken, chainId),
                              compact: true
                            })
                          ]
                        : '--'
                  },
                  {
                    label: t`Your wallet ${targetToken?.symbol || ''} balance`,
                    value:
                      targetBalance?.value !== undefined && targetAmount > 0n && targetToken
                        ? [
                            formatBigInt(targetBalance.value, {
                              unit: getTokenDecimals(targetToken, chainId),
                              compact: true
                            }),
                            formatBigInt(targetBalance.value + targetAmount, {
                              unit: getTokenDecimals(targetToken, chainId),
                              compact: true
                            })
                          ]
                        : '--'
                  }
                ]}
              />
            )}
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
}

export const L2TradeWidget = withWidgetProvider(TradeWidgetWrapped, 'L2TradeWidget');
