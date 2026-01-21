import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetContext } from '@widgets/context/WidgetContext';
import {
  MAX_SLIPPAGE_WITHOUT_WARNING,
  MAX_FEE_PERCENTAGE_WITHOUT_WARNING,
  EthFlowTxStatus,
  SUPPORTED_TOKEN_SYMBOLS,
  TradeScreen,
  ethFlowSlippageConfig,
  ercFlowSlippageConfig,
  ETH_SLIPPAGE_STORAGE_KEY,
  ERC_SLIPPAGE_STORAGE_KEY,
  l2EthFlowSlippageConfig,
  L2_ETH_SLIPPAGE_STORAGE_KEY
} from './lib/constants';
import {
  useTradeApprove,
  useTradeAllowance,
  useTokenBalance,
  useQuoteTrade,
  OrderQuoteSideKind,
  useTradeCosts,
  useSignAndCreateTradeOrder,
  useCreateEthTradeOrder,
  useSignAndCancelOrder,
  TokenForChain,
  getTokenDecimals,
  useCreatePreSignTradeOrder,
  useOnChainCancelOrder,
  useBatchUsdtApprove,
  gpv2VaultRelayerAddress
} from '@jetstreamgg/sky-hooks';
import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  formatBigInt,
  getTransactionLink,
  useIsSafeWallet,
  useDebounce,
  useIsSmartContractWallet,
  getCowExplorerLink,
  isL2ChainId
} from '@jetstreamgg/sky-utils';
import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { TxStatus, notificationTypeMaping } from '@widgets/shared/constants';
import { TradeTransactionStatus } from './components/TradeTransactionStatus';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { TradeAction, TradeFlow, TradeSide } from './lib/constants';
import { TradeInputs } from './components/TradeInputs';
import { getAllowedTargetTokens, getQuoteErrorForType, verifySlippage } from './lib/utils';
import { defaultConfig } from '@widgets/config/default-config';
import { useLingui } from '@lingui/react';
import { TradeHeader, TradeSubHeader, TradePoweredBy } from './components/TradeHeader';
import { formatUnits, parseUnits } from 'viem';
import { getValidatedState } from '@widgets/lib/utils';
import { TradeSummary } from './components/TradeSummary';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { useAddTokenToWallet } from '@widgets/shared/hooks/useAddTokenToWallet';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { useTokenImage } from '@widgets/shared/hooks/useTokenImage';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { useTokenBalances } from '@jetstreamgg/sky-hooks';
import { usePrices } from '@jetstreamgg/sky-hooks';

export type TradeWidgetProps = WidgetProps & {
  customTokenList?: TokenForChain[];
  disallowedPairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  widgetTitle?: ReactNode;
  tokensLocked?: boolean;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
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
  tokensLocked = false,
  batchEnabled: initialBatchEnabled = true,
  setBatchEnabled: externalSetBatchEnabled
}: TradeWidgetProps): React.ReactElement {
  const { mutate: addToWallet } = useAddTokenToWallet();
  const [showAddToken, setShowAddToken] = useState(false);
  const [tradeAnyway, setTradeAnyway] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [ethFlowTxStatus, setEthFlowTxStatus] = useState<EthFlowTxStatus>(EthFlowTxStatus.IDLE);
  const [internalBatchEnabled, setInternalBatchEnabled] = useState(initialBatchEnabled);
  const [isUsdtResetFlow, setIsUsdtResetFlow] = useState(false);

  // Use external setter if provided, otherwise use internal state
  const batchEnabled = externalSetBatchEnabled ? initialBatchEnabled : internalBatchEnabled;
  const setBatchEnabled = externalSetBatchEnabled || setInternalBatchEnabled;
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  const [formattedExecutedSellAmount, setFormattedExecutedSellAmount] = useState<string | undefined>(
    undefined
  );
  const [formattedExecutedBuyAmount, setFormattedExecutedBuyAmount] = useState<string | undefined>(undefined);

  const chainId = useChainId();
  const isChainL2 = isL2ChainId(chainId);
  const { address, isConnecting, isConnected } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const isSmartContractWallet = useIsSmartContractWallet();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const linguiCtx = useLingui();

  const wrappedNativeTokenAddress = useMemo(
    () => defaultConfig.tradeTokenList[chainId].find(token => token.isWrappedNative)?.address,
    [chainId, defaultConfig.tradeTokenList]
  );

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

  const { data: tokenBalances } = useTokenBalances({
    address,
    tokens: tokenList.map(token => ({
      address: token.address as `0x${string}` | undefined,
      isNative: token.isNative,
      symbol: token.symbol
    })),
    chainId,
    enabled: isConnectedAndEnabled
  });

  const { data: pricesData } = usePrices();

  const tokenUsdValues = useMemo(() => {
    const values = new Map<string, number>();

    if (tokenBalances && pricesData) {
      tokenBalances.forEach(balance => {
        const price = pricesData[balance.symbol]?.price || '0';
        const balanceNum = parseFloat(balance.formatted);
        const priceNum = parseFloat(price);

        if (!isNaN(balanceNum) && !isNaN(priceNum)) {
          const usdValue = balanceNum * priceNum;
          values.set(balance.symbol, usdValue);
        }
      });
    }

    return values;
  }, [tokenBalances, pricesData]);

  const sortByUsdValue = useCallback(
    (tokens: TokenForChain[]) => {
      if (!isConnectedAndEnabled || tokenUsdValues.size === 0) {
        return tokens;
      }

      return [...tokens].sort((a, b) => {
        const aValue = tokenUsdValues.get(a.symbol) || 0;
        const bValue = tokenUsdValues.get(b.symbol) || 0;
        return bValue - aValue;
      });
    },
    [isConnectedAndEnabled, tokenUsdValues]
  );

  const sortedTokenList = useMemo(() => {
    return sortByUsdValue(tokenList);
  }, [tokenList, sortByUsdValue]);

  const originTokenList = useMemo(() => {
    // We don't include the token if it has no pairs
    return sortedTokenList.filter(
      token => getAllowedTargetTokens(token.symbol, tokenList, disallowedPairs).length > 0
    );
  }, [sortedTokenList, tokenList, disallowedPairs]);

  const initialOriginTokenIndex = 0;
  const initialOriginToken =
    originTokenList.find(token => token.symbol.toLowerCase() === externalWidgetState?.token?.toLowerCase()) ||
    (originTokenList.length ? originTokenList[initialOriginTokenIndex] : undefined);

  const [originToken, setOriginToken] = useState<TokenForChain | undefined>(initialOriginToken);

  const targetTokenList = useMemo(() => {
    const allowedTokens = getAllowedTargetTokens(originToken?.symbol || '', tokenList, disallowedPairs);
    return sortByUsdValue(allowedTokens);
  }, [originToken?.symbol, tokenList, disallowedPairs, sortByUsdValue]);

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
    validatedExternalState?.targetAmount || '0',
    getTokenDecimals(targetToken, chainId)
  );
  const [targetAmount, setTargetAmount] = useState(initialTargetAmount);
  const debouncedTargetAmount = useDebounce(targetAmount);
  const [lastUpdated, setLastUpdated] = useState<TradeSide>(TradeSide.IN);
  const originTokenAddress = originToken?.address;
  const targetTokenAddress = targetToken?.address;
  const [ercFlowSlippage, setErcFlowSlippage] = useState(
    verifySlippage(window.localStorage.getItem(ERC_SLIPPAGE_STORAGE_KEY) || '', ercFlowSlippageConfig)
  );
  const [ethFlowSlippage, setEthFlowSlippage] = useState(
    verifySlippage(window.localStorage.getItem(ETH_SLIPPAGE_STORAGE_KEY) || '', ethFlowSlippageConfig)
  );
  const [l2EthFlowSlippage, setL2EthFlowSlippage] = useState(
    verifySlippage(window.localStorage.getItem(L2_ETH_SLIPPAGE_STORAGE_KEY) || '', l2EthFlowSlippageConfig)
  );
  const [ttl, setTtl] = useState('');

  const [slippage, setSlippage] = useMemo(() => {
    return originToken?.isNative
      ? isChainL2
        ? [l2EthFlowSlippage, setL2EthFlowSlippage]
        : [ethFlowSlippage, setEthFlowSlippage]
      : [ercFlowSlippage, setErcFlowSlippage];
  }, [originToken, l2EthFlowSlippage, ethFlowSlippage, ercFlowSlippage, isChainL2]);

  const {
    setButtonText,
    setBackButtonText,
    setCancelButtonText,
    setIsLoading,
    setIsDisabled,
    setTxStatus,
    setExternalLink,
    txStatus,
    widgetState,
    setWidgetState,
    setShowStepIndicator,
    orderId,
    setOrderId
  } = useContext(WidgetContext);

  useNotifyWidgetState({
    widgetState,
    txStatus,
    targetToken: targetToken?.symbol,
    executedSellAmount: formattedExecutedSellAmount,
    executedBuyAmount: formattedExecutedBuyAmount,
    onWidgetStateChange
  });

  //reset executed amounts when txStatus is back to idle
  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setFormattedExecutedSellAmount(undefined);
      setFormattedExecutedBuyAmount(undefined);
    }
  }, [txStatus]);

  const pairValid = !!originToken && !!targetToken && originToken.symbol !== targetToken.symbol;

  const { data: originBalance, refetch: refetchOriginBalance } = useTokenBalance({
    address,
    token: originTokenAddress,
    isNative: originToken?.isNative,
    chainId
  });

  const isBalanceError = Boolean(
    txStatus === TxStatus.IDLE &&
      originBalance &&
      debouncedOriginAmount > originBalance.value &&
      originAmount !== 0n
  );

  const { data: targetBalance, refetch: refetchTargetBalance } = useTokenBalance({
    address,
    token: targetToken?.isNative ? undefined : targetTokenAddress,
    isNative: targetToken?.isNative,
    chainId
  });

  const {
    data: allowance,
    mutate: mutateAllowance,
    isLoading: allowanceLoading
  } = useTradeAllowance(originTokenAddress);

  const {
    data: quoteData,
    isLoading: isQuoteLoading,
    error: quoteError
  } = useQuoteTrade({
    sellToken: originToken?.isNative ? wrappedNativeTokenAddress : originTokenAddress,
    buyToken: targetTokenAddress,
    amount: lastUpdated === TradeSide.IN ? debouncedOriginAmount : debouncedTargetAmount,
    kind: lastUpdated === TradeSide.IN ? OrderQuoteSideKind.SELL : OrderQuoteSideKind.BUY,
    isEthFlow: originToken?.isNative,
    isSmartContractWallet,
    slippage,
    enabled:
      (lastUpdated === TradeSide.IN
        ? debouncedOriginAmount === originAmount
        : debouncedTargetAmount === targetAmount) && widgetState.screen === TradeScreen.ACTION
  });

  useEffect(() => {
    if (quoteError) {
      const errorMessage = getQuoteErrorForType(quoteError.message);
      console.log(errorMessage);
      onNotification?.({
        title: t`Error fetching quote`,
        description: errorMessage,
        status: TxStatus.ERROR
      });
    }
  }, [quoteError]);

  useEffect(() => {
    // If any of these deps change we set the tradeAnyway to false
    setTradeAnyway(false);
  }, [originTokenAddress, targetTokenAddress, debouncedOriginAmount, debouncedTargetAmount]);

  const {
    data: { priceImpact, feePercentage }
  } = useTradeCosts({
    sellToken: originToken,
    buyToken: targetToken,
    sellAmountBeforeFee: quoteData?.quote.sellAmountBeforeFee,
    sellAmountAfterFee: quoteData?.quote.sellAmountAfterFee,
    buyAmountBeforeFee: quoteData?.quote.buyAmountBeforeFee,
    buyAmountAfterFee: quoteData?.quote.buyAmountAfterFee,
    kind: quoteData?.quote.kind
  });

  // If the origin token is ETH, we don't need to approve the contract
  const needsAllowance =
    originToken &&
    quoteData &&
    !originToken.isNative &&
    !!(!allowance || allowance < quoteData.quote.sellAmountToSign);

  // Check if this is USDT and needs allowance reset
  const isUsdt = originToken?.symbol === 'USDT';
  const needsUsdtReset =
    isUsdt &&
    allowance !== undefined &&
    quoteData?.quote.sellAmountToSign !== undefined &&
    allowance > 0n &&
    allowance < quoteData.quote.sellAmountToSign;

  // capture when we're in a USDT reset flow
  useEffect(() => {
    if (
      needsUsdtReset &&
      widgetState.action === TradeAction.APPROVE &&
      widgetState.screen === TradeScreen.TRANSACTION
    ) {
      setIsUsdtResetFlow(true);
    } else if (
      // Only reset when we exit the approve action entirely
      widgetState.action !== TradeAction.APPROVE ||
      txStatus === TxStatus.ERROR ||
      // Or when we move to a different screen that's not transaction
      (widgetState.action === TradeAction.APPROVE && widgetState.screen !== TradeScreen.TRANSACTION)
    ) {
      setIsUsdtResetFlow(false);
    }
  }, [needsUsdtReset, widgetState.action, widgetState.screen, txStatus]);

  // Get the trade spender address (same as used in useTradeApprove)
  const tradeSpenderAddress = useMemo(() => {
    return gpv2VaultRelayerAddress[chainId as keyof typeof gpv2VaultRelayerAddress];
  }, [chainId]);

  // Use batched USDT approve for USDT tokens that need reset
  const {
    execute: batchUsdtApproveExecute,
    prepared: batchUsdtApprovePrepared,
    isLoading: batchUsdtApproveIsLoading,
    error: batchUsdtApproveError
  } = useBatchUsdtApprove({
    tokenAddress: originTokenAddress,
    spender: tradeSpenderAddress,
    amount: quoteData?.quote.sellAmountToSign,
    shouldUseBatch: batchEnabled,
    onStart: () => {
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (hash: string | undefined) => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved ${originToken?.symbol ?? ''}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
    },
    onError: (error: Error, hash: string | undefined) => {
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
    enabled:
      needsUsdtReset &&
      widgetState.action === TradeAction.APPROVE &&
      allowance !== undefined &&
      originToken &&
      !originToken.isNative
  });

  // Use regular approve for non-USDT tokens or USDT that doesn't need reset
  const {
    execute: approveExecute,
    prepareError: approvePrepareError,
    prepared: approvePrepared,
    isLoading: approveIsLoading
  } = useTradeApprove({
    amount: quoteData?.quote.sellAmountToSign,
    tokenAddress: originTokenAddress,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Approving ${formatBigInt(debouncedOriginAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        })} ${originToken?.symbol ?? ''}`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (hash: string) => {
      onNotification?.({
        title: t`Approve successful`,
        description: t`You approved ${originToken?.symbol ?? ''}`,
        status: TxStatus.SUCCESS
      });
      setTxStatus(TxStatus.SUCCESS);
      mutateAllowance();
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    onError: (error: Error, hash: string) => {
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
    enabled:
      widgetState.action === TradeAction.APPROVE &&
      allowance !== undefined &&
      originToken &&
      !originToken.isNative &&
      !needsUsdtReset
  });

  const { execute: tradeExecute } = useSignAndCreateTradeOrder({
    order: quoteData,
    onStart: (orderId: string) => {
      setOrderId(orderId as `0x${string}`);
      setExternalLink(getCowExplorerLink(chainId, orderId));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash: orderId, widgetState, txStatus: TxStatus.LOADING });
      setCancelButtonText(t`Cancel order`);
    },
    onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => {
      //hardcoding the locale used for the externalized widget state because the widget consumer expects a constistent formatting
      const executedSellAmountEnUs = formatBigInt(executedSellAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(originToken, chainId)
      });
      const executedBuyAmountEnUs = formatBigInt(executedBuyAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(targetToken, chainId)
      });
      setFormattedExecutedSellAmount(executedSellAmountEnUs);
      setFormattedExecutedBuyAmount(executedBuyAmountEnUs);
      setOriginAmount(executedSellAmount);
      setTargetAmount(executedBuyAmount);
      onNotification?.({
        title: t`Trade successful`,
        description: t`You traded ${formatBigInt(executedSellAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        })} ${originToken?.symbol ?? ''} for ${formatBigInt(executedBuyAmount, {
          locale,
          unit: getTokenDecimals(targetToken, chainId)
        })} ${targetToken?.symbol ?? ''}`,
        status: TxStatus.SUCCESS,
        type: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
      });
      setTxStatus(TxStatus.SUCCESS);
      setBackButtonText(t`Back to Trade`);
      mutateAllowance();
      refetchOriginBalance();
      refetchTargetBalance();
      onWidgetStateChange?.({
        widgetState,
        txStatus: TxStatus.SUCCESS,
        executedBuyAmount: executedBuyAmountEnUs,
        executedSellAmount: executedSellAmountEnUs
      });
      setShowAddToken(true);
    },
    onError: (error: Error) => {
      onNotification?.({
        title: t`Signing failed`,
        description: t`Something went wrong when trying to sign the message. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const { execute: preSignTradeExecute } = useCreatePreSignTradeOrder({
    order: quoteData,
    onStart: (orderId: string) => {
      setOrderId(orderId as `0x${string}`);
      setExternalLink(getCowExplorerLink(chainId, orderId));
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash: orderId, widgetState, txStatus: TxStatus.LOADING });
      setCancelButtonText(t`Cancel order`);
    },
    onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => {
      //hardcoding the locale used for the externalized widget state because the widget consumer expects a constistent formatting
      const executedSellAmountEnUs = formatBigInt(executedSellAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(originToken, chainId)
      });
      const executedBuyAmountEnUs = formatBigInt(executedBuyAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(targetToken, chainId)
      });
      setFormattedExecutedSellAmount(executedSellAmountEnUs);
      setFormattedExecutedBuyAmount(executedBuyAmountEnUs);
      setOriginAmount(executedSellAmount);
      setTargetAmount(executedBuyAmount);
      onNotification?.({
        title: t`Trade successful`,
        description: t`You traded ${formatBigInt(executedSellAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        })} ${originToken?.symbol ?? ''} for ${formatBigInt(executedBuyAmount, {
          locale,
          unit: getTokenDecimals(targetToken, chainId)
        })} ${targetToken?.symbol ?? ''}`,
        status: TxStatus.SUCCESS,
        type: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
      });
      setTxStatus(TxStatus.SUCCESS);
      setBackButtonText(t`Back to Trade`);
      mutateAllowance();
      refetchOriginBalance();
      refetchTargetBalance();
      onWidgetStateChange?.({
        widgetState,
        txStatus: TxStatus.SUCCESS,
        executedBuyAmount: executedBuyAmountEnUs,
        executedSellAmount: executedSellAmountEnUs
      });
      setShowAddToken(true);
    },
    onError: (error: Error) => {
      onNotification?.({
        title: t`Order creation failed`,
        description: t`Something went wrong when trying to post the order to the Order Book. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    onTransactionError: (error: Error) => {
      onNotification?.({
        title: t`Presign transaction error`,
        description: t`Something went wrong when trying to send the presign transaction. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const {
    execute: ethTradeExecute,
    prepareError: ethTradePrepareError,
    prepared: ethTradePrepared,
    isLoading: isEthTradeLoading
  } = useCreateEthTradeOrder({
    order: quoteData,
    enabled: originToken?.isNative ? true : false,
    onStart: (hash: string) => {
      addRecentTransaction?.({
        hash,
        description: t`Sending ${formatBigInt(debouncedOriginAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        })} ${originToken?.symbol ?? ''} to the EthFlow contract`
      });
      setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      setTxStatus(TxStatus.LOADING);
      setEthFlowTxStatus(EthFlowTxStatus.SENDING_ETH);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onEthSent: () => {
      setEthFlowTxStatus(EthFlowTxStatus.CREATING_ORDER);
    },
    onOrderCreated: (orderId: string) => {
      setExternalLink(getCowExplorerLink(chainId, orderId));
      setEthFlowTxStatus(EthFlowTxStatus.ORDER_CREATED);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: (executedSellAmount: bigint, executedBuyAmount: bigint) => {
      //hardcoding the locale used for the externalized widget state because the widget consumer expects a constistent formatting
      const executedSellAmountEnUs = formatBigInt(executedSellAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(originToken, chainId)
      });
      const executedBuyAmountEnUs = formatBigInt(executedBuyAmount, {
        locale: 'en-US',
        unit: getTokenDecimals(targetToken, chainId)
      });
      setFormattedExecutedSellAmount(executedSellAmountEnUs);
      setFormattedExecutedBuyAmount(executedBuyAmountEnUs);
      setOriginAmount(executedSellAmount);
      setTargetAmount(executedBuyAmount);
      onNotification?.({
        title: t`Trade successful`,
        description: t`You traded ${formatBigInt(executedSellAmount, {
          locale,
          unit: getTokenDecimals(originToken, chainId)
        })} ${originToken?.symbol ?? ''} for ${formatBigInt(executedBuyAmount, {
          locale,
          unit: getTokenDecimals(targetToken, chainId)
        })} ${targetToken?.symbol ?? ''}`,
        status: TxStatus.SUCCESS,
        type: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
      });
      setTxStatus(TxStatus.SUCCESS);
      setEthFlowTxStatus(EthFlowTxStatus.SUCCESS);
      setBackButtonText(t`Back to Trade`);
      refetchOriginBalance();
      refetchTargetBalance();
      onWidgetStateChange?.({
        widgetState,
        txStatus: TxStatus.SUCCESS,
        executedBuyAmount: executedBuyAmountEnUs,
        executedSellAmount: executedSellAmountEnUs
      });
      setShowAddToken(true);
    },
    onError: (error: Error) => {
      onNotification?.({
        title: t`Signing failed`,
        description: t`Something went wrong when trying to sign the message. Please try again.`,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      setEthFlowTxStatus(EthFlowTxStatus.ERROR);
      onWidgetStateChange?.({ widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    }
  });

  const { execute: offChainCancelExecute } = useSignAndCancelOrder({
    orderUids: orderId ? [orderId] : [],
    enabled: !isSmartContractWallet,
    onStart: () => {
      setCancelLoading(true);
    },
    onSuccess: () => {
      onNotification?.({
        title: t`Cancel successful`,
        description: t`You successfully cancelled the order`,
        status: TxStatus.SUCCESS
      });
      if (widgetState.screen === TradeScreen.TRANSACTION) {
        setTxStatus(TxStatus.CANCELLED);
      }
      setCancelLoading(false);
    },
    onError: (error: Error) => {
      console.error(error);
      onNotification?.({
        title: t`Cancel error`,
        description: t`Order cancellation attempt failed`,
        status: TxStatus.SUCCESS
      });
      setCancelLoading(false);
    }
  });

  const { execute: onChainCancelExecute, prepared: onChainCancelPrepared } = useOnChainCancelOrder({
    orderUid: orderId,
    enabled: isSmartContractWallet,
    onStart: (hash: string) => {
      setCancelLoading(true);
      addRecentTransaction?.({
        hash,
        description: t`Canceling order`
      });
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    onSuccess: () => {
      onNotification?.({
        title: t`Cancel successful`,
        description: t`You successfully cancelled the order`,
        status: TxStatus.SUCCESS
      });
      if (widgetState.screen === TradeScreen.TRANSACTION) {
        setTxStatus(TxStatus.CANCELLED);
      }
      setCancelLoading(false);
    },
    onError: (error: Error) => {
      console.error(error);
      onNotification?.({
        title: t`Cancel error`,
        description: t`Order cancellation attempt failed`,
        status: TxStatus.SUCCESS
      });
      setCancelLoading(false);
    }
  });

  const onCancelOrderClick = useCallback(() => {
    if (isSmartContractWallet) {
      onChainCancelExecute();
    } else {
      offChainCancelExecute();
    }
  }, [isSmartContractWallet, onChainCancelExecute, offChainCancelExecute]);

  const prepareError = approvePrepareError || ethTradePrepareError || batchUsdtApproveError;

  const isAmountWaitingForDebounce =
    debouncedOriginAmount !== originAmount || debouncedTargetAmount !== targetAmount;

  const disabledDueToHighCosts =
    ((priceImpact !== undefined && priceImpact >= MAX_SLIPPAGE_WITHOUT_WARNING) ||
      (feePercentage !== undefined && feePercentage >= MAX_FEE_PERCENTAGE_WITHOUT_WARNING)) &&
    !tradeAnyway &&
    txStatus === TxStatus.IDLE;

  const approvalPrepared = needsUsdtReset ? batchUsdtApprovePrepared : approvePrepared;
  const approvalLoading = needsUsdtReset ? batchUsdtApproveIsLoading : approveIsLoading;

  const approveDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isBalanceError ||
    (!originToken?.isNative && !approvalPrepared) ||
    (originToken?.isNative && !ethTradePrepared) ||
    approvalLoading ||
    isQuoteLoading ||
    !pairValid ||
    disabledDueToHighCosts ||
    (!originToken.isNative && allowance === undefined) ||
    allowanceLoading ||
    isAmountWaitingForDebounce;

  const tradeDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isBalanceError ||
    isQuoteLoading ||
    !quoteData ||
    !pairValid ||
    disabledDueToHighCosts ||
    (!originToken.isNative && allowance === undefined) ||
    (originToken.isNative && !ethTradePrepared) ||
    (originToken.isNative && isEthTradeLoading) ||
    allowanceLoading ||
    needsAllowance ||
    isAmountWaitingForDebounce;

  useEffect(() => {
    if (!originToken?.isNative && isSmartContractWallet) {
      setCancelLoading(!onChainCancelPrepared);
    }
  }, [isSmartContractWallet, onChainCancelPrepared]);

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

  // If we need allowance, set the action to approve
  useEffect(() => {
    if (widgetState.flow === TradeFlow.TRADE && widgetState.screen === TradeScreen.ACTION) {
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: needsAllowance && !allowanceLoading ? TradeAction.APPROVE : TradeAction.TRADE
      }));
    }
  }, [widgetState.flow, widgetState.screen, needsAllowance, allowanceLoading]);

  // update target/origin amount input when quote data changes
  useEffect(() => {
    const setFn = lastUpdated === TradeSide.IN ? setTargetAmount : setOriginAmount;
    const newAmount =
      lastUpdated === TradeSide.IN
        ? quoteData?.quote?.buyAmountAfterFee
        : quoteData?.quote?.sellAmountBeforeFee;
    setFn(newAmount || 0n);

    // When target input is updated (lastUpdated === OUT), notify URL params of origin amount change
    if (lastUpdated === TradeSide.OUT && originToken) {
      if (!newAmount || newAmount === 0n) {
        // If amount is 0 or undefined, clear the URL parameter
        onWidgetStateChange?.({
          originAmount: '',
          txStatus,
          widgetState
        });
      } else {
        // Update URL with the new calculated amount
        const formattedValue = formatUnits(newAmount, getTokenDecimals(originToken, chainId));
        onWidgetStateChange?.({
          originAmount: formattedValue,
          txStatus,
          widgetState
        });
      }
    }
  }, [quoteData?.quote?.buyAmountAfterFee, quoteData?.quote?.sellAmountBeforeFee, lastUpdated]);

  // Update button state according to action and tx
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (widgetState.action === TradeAction.APPROVE && txStatus === TxStatus.SUCCESS) {
        setButtonText(t`Continue`);
      } else if (txStatus === TxStatus.SUCCESS) {
        if (targetToken?.symbol !== 'ETH' && showAddToken) {
          setButtonText(t`Add ${targetToken?.symbol || ''} to wallet`);
          // This should run after adding the token
        } else if (customNavigationLabel && !showAddToken) {
          setButtonText(customNavigationLabel);
        } else {
          setButtonText(t`Back to Trade`);
        }
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (txStatus === TxStatus.CANCELLED) {
        setButtonText(t`Back to Trade`);
      } else if (widgetState.screen === TradeScreen.ACTION && quoteData?.quote) {
        setButtonText(t`Review trade`);
      } else if (isQuoteLoading) {
        setButtonText(t`Review trade`);
      } else if (widgetState.screen === TradeScreen.ACTION && !targetToken) {
        setButtonText(t`Select a token`);
      } else if (widgetState.screen === TradeScreen.ACTION && originAmount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (
        widgetState.screen === TradeScreen.REVIEW &&
        (widgetState.action === TradeAction.APPROVE || widgetState.action === TradeAction.TRADE)
      ) {
        setButtonText(t`Confirm trade details`);
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [
    isQuoteLoading,
    quoteData?.quote,
    txStatus,
    isConnectedAndEnabled,
    originAmount,
    linguiCtx,
    widgetState,
    chainId,
    targetToken,
    showAddToken
  ]);

  // set widget button to be disabled depending on which action we're performing
  useEffect(() => {
    // For review screen, only check basic conditions
    if (widgetState.screen === TradeScreen.ACTION) {
      const reviewDisabled =
        isConnectedAndEnabled &&
        (isBalanceError ||
          !pairValid ||
          disabledDueToHighCosts ||
          !originToken ||
          !targetToken ||
          originAmount === 0n ||
          !quoteData ||
          isQuoteLoading ||
          allowanceLoading ||
          isAmountWaitingForDebounce);
      setIsDisabled(reviewDisabled);
    } else {
      const shouldDisable =
        isConnectedAndEnabled &&
        !!(
          (widgetState.action === TradeAction.APPROVE &&
            (txStatus === TxStatus.SUCCESS ? tradeDisabled : approveDisabled)) ||
          (widgetState.action === TradeAction.TRADE && tradeDisabled && txStatus !== TxStatus.SUCCESS)
        );

      setIsDisabled(shouldDisable);
    }
  }, [
    isQuoteLoading,
    isConnectedAndEnabled,
    approveDisabled,
    tradeDisabled,
    widgetState.action,
    widgetState.screen,
    isBalanceError,
    pairValid,
    disabledDueToHighCosts,
    originToken,
    targetToken,
    originAmount,
    quoteData,
    allowanceLoading,
    isAmountWaitingForDebounce
  ]);

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

  // Reset widget state after switching network
  useEffect(() => {
    setOriginAmount(initialOriginAmount);
    setTargetAmount(initialTargetAmount);
    setLastUpdated(TradeSide.IN);
    setTargetToken(initialTargetToken);
    setTxStatus(TxStatus.IDLE);
    setEthFlowTxStatus(EthFlowTxStatus.IDLE);
    setWidgetState({
      flow: TradeFlow.TRADE,
      action: TradeAction.TRADE,
      screen: TradeScreen.ACTION
    });

    // Reset additional state
    setTradeAnyway(false);
    setShowAddToken(false);
    setCancelLoading(false);
    setOrderId(undefined);
    setExternalLink(undefined);
    setFormattedExecutedSellAmount(undefined);
    setFormattedExecutedBuyAmount(undefined);
  }, [chainId]);

  useEffect(() => {
    if (prepareError) {
      console.log(prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [prepareError]);

  useEffect(() => {
    const tokensHasChanged =
      externalWidgetState?.token?.toLowerCase() !== originToken?.symbol?.toLowerCase() ||
      externalWidgetState?.targetToken?.toLowerCase() !== targetToken?.symbol?.toLowerCase();

    // Compare bigint values directly to avoid precision loss
    const amountHasChanged =
      externalWidgetState?.amount !== undefined &&
      parseUnits(externalWidgetState.amount, getTokenDecimals(originToken, chainId)) !== originAmount;

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
          const tokenChanged = newOriginToken.symbol !== originToken?.symbol;
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

          // Handle amount updates
          if (externalWidgetState?.amount !== undefined) {
            if (tokenChanged || amountHasChanged) {
              const newAmount = parseUnits(
                externalWidgetState.amount,
                getTokenDecimals(newOriginToken, chainId)
              );
              setTimeout(() => {
                setOriginAmount(newAmount);
                setTargetAmount(0n);
                setLastUpdated(TradeSide.IN);
              }, 500);
            }
          } else {
            setOriginAmount(0n);
            setTargetAmount(0n);
          }
        }
      }

      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: needsAllowance ? TradeAction.APPROVE : TradeAction.TRADE,
        screen: TradeScreen.ACTION
      }));
    }
  }, [externalWidgetState, txStatus]);

  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(!!(!originToken?.isNative && needsAllowance));
    }
  }, [txStatus, originToken?.isNative, needsAllowance, setShowStepIndicator]);

  useEffect(() => {
    if (targetToken === undefined) {
      onWidgetStateChange?.({
        targetToken: '',
        txStatus,
        widgetState
      });
    }
  }, [targetToken]);

  const approveOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: TradeScreen.TRANSACTION
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);

    // Use appropriate approve function based on USDT reset requirement
    if (needsUsdtReset) {
      batchUsdtApproveExecute();
    } else {
      approveExecute();
    }
  };

  const tradeOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: TradeScreen.TRANSACTION,
      action: TradeAction.TRADE
    }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);
    if (originToken?.isNative) {
      setEthFlowTxStatus(EthFlowTxStatus.INITIALIZED);
      ethTradeExecute();
    } else if (isSmartContractWallet) {
      preSignTradeExecute();
    } else {
      tradeExecute();
    }
  };

  const nextOnClick = () => {
    setEthFlowTxStatus(EthFlowTxStatus.IDLE);
    setTxStatus(TxStatus.IDLE);

    // After a successful trade, reset everything to initial state
    if (widgetState.action !== TradeAction.APPROVE) {
      setTimeout(() => {
        setOriginAmount(0n);
        setTargetAmount(0n);
        setOriginToken(initialOriginToken);
        setTargetToken(undefined); // Clear target token
        setLastUpdated(TradeSide.IN);
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

    if (widgetState.action === TradeAction.APPROVE && !needsAllowance) {
      // If we just finished approving, we want to go directly to the next action
      return tradeOnClick();
    }

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: needsAllowance ? TradeAction.APPROVE : TradeAction.TRADE,
      screen: TradeScreen.ACTION
    }));
  };

  const reviewOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setEthFlowTxStatus(EthFlowTxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: TradeScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    if (widgetState.action === TradeAction.TRADE && txStatus === TxStatus.SUCCESS) {
      // If success trade we restart the flow
      nextOnClick();
    } else {
      setTxStatus(TxStatus.IDLE);
      setEthFlowTxStatus(EthFlowTxStatus.IDLE);
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
      void addToWallet({
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
          setEthFlowTxStatus(EthFlowTxStatus.IDLE);
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

  // Handle the error onClicks separately to keep it clean
  const errorOnClick = () => {
    return widgetState.action === TradeAction.TRADE
      ? tradeOnClick()
      : widgetState.action === TradeAction.APPROVE
        ? approveOnClick()
        : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : widgetState.action === TradeAction.TRADE &&
        txStatus === TxStatus.SUCCESS &&
        targetToken?.symbol !== 'ETH' &&
        showAddToken
      ? onAddToken
      : txStatus === TxStatus.SUCCESS && customNavigationLabel
        ? onCustomNavigation
        : txStatus === TxStatus.SUCCESS
          ? nextOnClick
          : txStatus === TxStatus.ERROR
            ? errorOnClick
            : txStatus === TxStatus.CANCELLED
              ? nextOnClick
              : widgetState.screen === TradeScreen.ACTION
                ? reviewOnClick
                : widgetState.action === TradeAction.APPROVE
                  ? approveOnClick
                  : widgetState.action === TradeAction.TRADE
                    ? tradeOnClick
                    : undefined;

  const onUserSwitchTokens = useCallback(
    (originSymbol?: string, targetSymbol?: string) => {
      // if tokens are back to the original state, we set it to false
      const tokensHasChanged =
        externalWidgetState?.token !== originSymbol || externalWidgetState?.targetToken !== targetSymbol;
      if (tokensHasChanged) {
        onWidgetStateChange?.({
          originToken: originSymbol,
          targetToken: targetSymbol,
          originAmount: '',
          txStatus,
          widgetState
        });
      }
    },
    [externalWidgetState]
  );

  const showSecondaryButton =
    !!customNavigationLabel ||
    txStatus === TxStatus.ERROR ||
    (widgetState.action === TradeAction.TRADE && widgetState.screen === TradeScreen.REVIEW) ||
    (widgetState.action === TradeAction.APPROVE && widgetState.screen === TradeScreen.REVIEW) ||
    // After a successful trade, show the back button, as long as target token is not ETH
    (targetToken?.symbol !== 'ETH' &&
      widgetState.action === TradeAction.TRADE &&
      txStatus === TxStatus.SUCCESS) ||
    // After a successful approve transaction, show the back button
    (txStatus === TxStatus.SUCCESS &&
      widgetState.action === TradeAction.APPROVE &&
      widgetState.screen === TradeScreen.TRANSACTION);

  const showCancelOrderButton =
    (txStatus === TxStatus.LOADING || txStatus === TxStatus.ERROR) &&
    widgetState.flow === TradeFlow.TRADE &&
    widgetState.action === TradeAction.TRADE &&
    widgetState.screen === TradeScreen.TRANSACTION &&
    !originToken?.isNative;

  return (
    <WidgetContainer
      header={
        <TradeHeader
          slippage={slippage}
          setSlippage={setSlippage}
          isEthFlow={originToken?.isNative}
          ttl={ttl}
          setTtl={setTtl}
        />
      }
      subHeader={<TradeSubHeader />}
      rightHeader={rightHeaderComponent}
      footer={
        <WidgetButtons
          onClickAction={onClickAction}
          onClickBack={onClickBack}
          showSecondaryButton={showSecondaryButton}
          enabled={enabled}
          showCancelButton={showCancelOrderButton}
          onClickCancel={onCancelOrderClick}
          cancelLoading={cancelLoading}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <div className="mt-[-16px] space-y-0">
        <TradePoweredBy onExternalLinkClicked={onExternalLinkClicked} />
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {widgetState.screen === TradeScreen.REVIEW && quoteData && originToken && targetToken ? (
          <CardAnimationWrapper key="widget-summary">
            <TradeSummary
              quoteData={quoteData}
              lastUpdated={lastUpdated}
              originToken={originToken}
              targetToken={targetToken}
              priceImpact={priceImpact}
              allowance={allowance}
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
            />
          </CardAnimationWrapper>
        ) : txStatus !== TxStatus.IDLE && widgetState.screen === TradeScreen.TRANSACTION ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <TradeTransactionStatus
              originToken={originToken as any} // TODO fix this type
              originAmount={originAmount}
              targetToken={targetToken as any} // TODO fix this type
              targetAmount={targetAmount}
              lastUpdated={lastUpdated}
              isEthFlow={!!originToken?.isNative}
              ethFlowTxStatus={ethFlowTxStatus}
              onExternalLinkClicked={onExternalLinkClicked}
              needsUsdtReset={needsUsdtReset}
              isUsdtResetFlow={isUsdtResetFlow}
              isBatchTransaction={batchEnabled}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <TradeInputs
              setOriginAmount={setOriginAmount}
              originAmount={originAmount}
              setLastUpdated={setLastUpdated}
              lastUpdated={lastUpdated}
              originBalance={originBalance}
              originToken={originToken}
              targetBalance={targetToken ? targetBalance : undefined}
              targetToken={targetToken}
              setOriginToken={setOriginToken}
              setTargetToken={setTargetToken}
              setTargetAmount={setTargetAmount}
              targetAmount={targetAmount}
              quoteData={quoteData}
              quoteError={quoteError}
              originTokenList={tokensLocked && originToken ? [originToken] : originTokenList}
              targetTokenList={tokensLocked && targetToken ? [targetToken] : targetTokenList}
              isBalanceError={isBalanceError}
              isQuoteLoading={isQuoteLoading}
              canSwitchTokens={!tokensLocked}
              priceImpact={priceImpact}
              feePercentage={feePercentage}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onUserSwitchTokens={onUserSwitchTokens}
              tradeAnyway={tradeAnyway}
              setTradeAnyway={setTradeAnyway}
              enableSearch={true}
              tokensLocked={tokensLocked}
              onOriginTokenChange={(token: TokenForChain) => {
                onWidgetStateChange?.({
                  originToken: token.symbol,
                  txStatus,
                  widgetState
                });
              }}
              onTargetTokenChange={(token: TokenForChain) => {
                onWidgetStateChange?.({
                  targetToken: token.symbol,
                  txStatus,
                  widgetState
                });
              }}
              onOriginInputChange={(newValue: bigint, userTriggered?: boolean) => {
                if (originToken && userTriggered) {
                  // Convert 0n to empty string to properly clear URL params
                  const formattedValue =
                    newValue === 0n ? '' : formatUnits(newValue, getTokenDecimals(originToken, chainId));
                  onWidgetStateChange?.({
                    originAmount: formattedValue,
                    txStatus,
                    widgetState
                  });
                }
              }}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
}

export const TradeWidget = withWidgetProvider(TradeWidgetWrapped, 'TradeWidget');
