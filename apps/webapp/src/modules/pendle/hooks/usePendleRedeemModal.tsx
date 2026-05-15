import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
import {
  getTokenDecimals,
  isMarketMatured,
  PendleConvertSide,
  useBatchPendleConvert,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import {
  PendleConfigMenu,
  pendleAnalyticsData,
  usePendleSlippage,
  usePendleTokens
} from '@/widgets';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { PendleRedeem } from '../components/PendleRedeem';

type Options = {
  /** Called after redeem confirms onchain — for refetching balances etc. */
  onSuccess?: () => void;
  /** Toast / notification adapter from the surrounding module. */
  onNotification?: (msg: { title: string; description: string; status: 'success' | 'error' }) => void;
};

/**
 * Matured-PT redeem via the global TransactionContext modal. Routes through
 * the same /convert pipeline as buy/sell so the user can pick the underlying,
 * USDS, or USDC.
 */
export function usePendleRedeemModal(market: PendleMarketConfig, opts: Options = {}) {
  const { launch, updateModalContent, isModalOpen, txCallbacks } = useTransaction();
  // Per-instance id so the provider can ignore live updates from sibling cards.
  const sessionId = useId();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const { underlyingToken, ptToken, inputTokenList } = usePendleTokens(market);
  const [selectedOutputToken, setSelectedOutputToken] = useState<Token>(underlyingToken);
  const outputTokenAddress = selectedOutputToken.address[mainnet.id] as `0x${string}`;

  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage('redeem');

  // Quote: PT → user-selected output via /convert. The `maturedExit` flag
  // adds the YT-with-zero-amount entry the API requires for matured exits.
  const { data: quote, isLoading: isFetchingQuote } = useQuotePendleConvert({
    side: PendleConvertSide.WITHDRAW,
    marketAddress: market.marketAddress,
    inputToken: market.ptToken,
    outputToken: outputTokenAddress,
    underlyingToken: market.underlyingToken,
    amountIn: isRedeemable ? ptBalance : undefined,
    slippage,
    enabled: isRedeemable,
    maturedExit: true,
    ytToken: market.ytToken
  });

  const writeHook = useBatchPendleConvert({
    side: PendleConvertSide.WITHDRAW,
    marketAddress: market.marketAddress,
    inputToken: market.ptToken,
    outputToken: outputTokenAddress,
    underlyingToken: market.underlyingToken,
    amountIn: isRedeemable ? ptBalance : undefined,
    quote,
    enabled: isRedeemable,
    shouldUseBatch: true,
    onMutate: () => txCallbacks.onMutate(),
    onStart: hash => txCallbacks.onStart(hash),
    onSuccess: hash => {
      mutatePtBalances();
      opts.onSuccess?.();
      txCallbacks.onSuccess(hash);
      opts.onNotification?.({
        title: t`Redemption complete`,
        description: t`${selectedOutputToken.symbol} delivered to your wallet.`,
        status: 'success'
      });
    },
    onError: (err, hash) => {
      txCallbacks.onError(err, hash);
      opts.onNotification?.({
        title: t`Transaction failed`,
        description: err.message,
        status: 'error'
      });
    }
  });

  // Map raw revert messages to user-friendly copy. Mirrors the PendleWidget
  // mapping so users see consistent guidance whether they're buying, selling,
  // or redeeming.
  const prepareErrorMessage = useMemo<string | undefined>(() => {
    const raw = writeHook.error?.message;
    if (!raw) return undefined;
    if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
      return t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon, or wait for the quote to refresh.`;
    }
    if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
      return t`Quote expired. Refreshing — please wait a moment.`;
    }
    return t`Unable to prepare transaction. Please try again or adjust your inputs.`;
  }, [writeHook.error]);

  const transactionContent = useMemo(
    () => (
      <PendleRedeem
        market={market}
        ptBalance={ptBalance}
        outputTokenList={inputTokenList}
        selectedOutputToken={selectedOutputToken}
        onOutputTokenChange={setSelectedOutputToken}
        quote={quote}
        isFetchingQuote={isFetchingQuote}
        slippage={slippage}
        prepareErrorMessage={prepareErrorMessage}
      />
    ),
    [
      market,
      ptBalance,
      inputTokenList,
      selectedOutputToken,
      quote,
      isFetchingQuote,
      slippage,
      prepareErrorMessage
    ]
  );

  const rightHeaderComponent = useMemo(
    () => (
      <PendleConfigMenu slippage={slippage} defaultSlippage={defaultSlippage} setSlippage={setSlippage} />
    ),
    [slippage, defaultSlippage, setSlippage]
  );

  const confirmDisabled = !writeHook.prepared || isFetchingQuote || writeHook.isLoading;

  const openRedeemModal = useCallback(() => {
    const toDecimals = getTokenDecimals(selectedOutputToken, mainnet.id);
    const data = pendleAnalyticsData({
      market,
      side: 'redeem',
      originToken: ptToken,
      targetToken: selectedOutputToken,
      amountFromBigint: ptBalance,
      amountToBigint: quote?.amountOut ?? 0n,
      fromDecimals: market.underlyingDecimals,
      toDecimals,
      slippage,
      quote,
      isBatchTx: true
    });
    // `useAppAnalytics` has no sign-flip helper — emit the withdrawal sign
    // explicitly so dashboard tiles filtering `properties.amount < 0` pick
    // up redeem as a withdrawal alongside SELL.
    launch({
      title: t`Redeem PT-${market.underlyingSymbol}`,
      transactionContent,
      rightHeaderComponent,
      confirmLabel: t`Confirm`,
      confirmDisabled,
      onConfirm: () => writeHook.execute(),
      sessionId,
      analytics: {
        widgetName: 'fixed',
        flow: 'redeem',
        action: 'redeem',
        data: {
          ...data,
          amount: -Number(formatUnits(ptBalance, market.underlyingDecimals))
        }
      }
    });
  }, [
    launch,
    writeHook,
    market,
    ptToken,
    ptBalance,
    selectedOutputToken,
    quote,
    slippage,
    transactionContent,
    rightHeaderComponent,
    confirmDisabled,
    sessionId
  ]);

  useEffect(() => {
    if (!isModalOpen) return;
    updateModalContent(sessionId, { transactionContent, rightHeaderComponent, confirmDisabled });
  }, [isModalOpen, sessionId, updateModalContent, transactionContent, rightHeaderComponent, confirmDisabled]);

  return {
    openRedeemModal,
    isRedeemable,
    isPrepared: writeHook.prepared,
    ptBalance,
    error: writeHook.error
  };
}
