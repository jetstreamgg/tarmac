import { useCallback, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { mainnet } from 'viem/chains';
import {
  isMarketMatured,
  PendleConvertSide,
  useBatchPendleConvert,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  type PendleMarketConfig,
  type Token
} from '@jetstreamgg/sky-hooks';
import { PendleConfigMenu, usePendleSlippage, usePendleTokens } from '@jetstreamgg/sky-widgets';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { PendleRedeem } from '../components/PendleRedeem';

type Options = {
  /** Called after redeem confirms onchain — for refetching balances etc. */
  onSuccess?: () => void;
  /** Toast / notification adapter from the surrounding module. */
  onNotification?: (msg: { title: string; description: string; status: 'success' | 'error' }) => void;
};

/**
 * Single-market matured-PT redeem via the global TransactionContext modal.
 *
 * Routes through the same /convert pipeline as buy/sell so the user can pick
 * the underlying, USDS, or USDC as the output token. Pendle's API returns
 * `exitPostExpToToken` quotes either with empty swapData (1:1 underlying
 * redeem) or a populated aggregator route (USDS / USDC via PendleSwap →
 * KyberSwap / Odos / OKX / Paraswap). buildVerifiedArgs handles both branches
 * through the same trust anchors as the pre-maturity flows.
 */
export function usePendleRedeemModal(market: PendleMarketConfig, opts: Options = {}) {
  const { launch, txCallbacks } = useTransaction();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const { underlyingToken, inputTokenList } = usePendleTokens(market);
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

  const transactionContent = (
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
  );

  const rightHeaderComponent = (
    <PendleConfigMenu slippage={slippage} defaultSlippage={defaultSlippage} setSlippage={setSlippage} />
  );

  const openRedeemModal = useCallback(() => {
    launch({
      title: t`Redeem PT-${market.underlyingSymbol}`,
      transactionContent,
      rightHeaderComponent,
      confirmLabel: t`Confirm`,
      onConfirm: () => writeHook.execute(),
      analytics: {
        widgetName: 'fixed',
        flow: 'redeem',
        action: 'redeem',
        data: {
          market: market.marketAddress,
          underlyingSymbol: market.underlyingSymbol,
          outputToken: selectedOutputToken.symbol
        }
      }
    });
  }, [
    launch,
    writeHook,
    market.underlyingSymbol,
    market.marketAddress,
    selectedOutputToken.symbol,
    transactionContent,
    rightHeaderComponent
  ]);

  return {
    openRedeemModal,
    isRedeemable,
    isPrepared: writeHook.prepared,
    ptBalance,
    error: writeHook.error
  };
}
