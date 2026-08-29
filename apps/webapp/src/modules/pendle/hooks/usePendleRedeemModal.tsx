import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';
import { mainnet } from 'viem/chains';
import { useChainId, useChains, useConnection, useSwitchChain } from 'wagmi';
import {
  getTokenDecimals,
  isMarketMatured,
  isPendleChain,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useBatchPendleConvert,
  useIsSafeWallet,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  useTokenAllowance,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { familyMainnetId, formatBigInt, isTestnetId } from '@/utils';
import { Intent } from '@/lib/enums';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { pendleAnalyticsData, pendleNonPtLeg, usePendleTokens, usePendleUsdValue, TxStatus } from '@/widgets';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { PendleRedeem } from '../components/PendleRedeem';
import { pendlePrepareErrorMessage } from '../utils/prepareErrorMessage';
import { usePendleSlippageCell } from './usePendleSlippageCell';

/**
 * Matured-PT redeem via the global TransactionContext modal. Routes through
 * the same /convert pipeline as buy/sell so the user can pick the underlying,
 * USDS, or USDC.
 */
export function usePendleRedeemModal(market: PendleMarketConfig) {
  const { launch, updateModalContent, isModalOpen, txStatus, txCallbacks } = useTransaction();
  // Per-instance id so the provider can ignore live updates from sibling cards.
  const sessionId = useId();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const { ptToken, withdrawTokenList } = usePendleTokens(market);
  const [selectedOutputToken, setSelectedOutputToken] = useState<Token>(withdrawTokenList[0]);
  const outputTokenAddress = selectedOutputToken.address[mainnet.id] as `0x${string}`;

  const { slippage, slippageDisplay, slippageMode, slippageAction } = usePendleSlippageCell('redeem');
  // Values the redeemed output leg in USD for the analytics `amount` property.
  const valueUsd = usePendleUsdValue();

  // Quote: PT → user-selected output via /convert. The `maturedExit` flag
  // adds the YT-with-zero-amount entry the API requires for matured exits.
  const { data: quote, isLoading: isFetchingQuote } = useQuotePendleConvert({
    side: PendleConvertSide.WITHDRAW,
    marketAddress: market.marketAddress,
    inputToken: market.ptToken,
    outputToken: outputTokenAddress,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: isRedeemable ? ptBalance : undefined,
    slippage,
    enabled: isRedeemable,
    // Fetch once for the card's isPrepared gating; only repoll while the
    // quote is on screen — this hook mounts once per matured card.
    poll: isModalOpen,
    maturedExit: true,
    ytToken: market.ytToken
  });

  const shouldUseBatch = useShouldUseBatch();
  const writeHook = useBatchPendleConvert({
    side: PendleConvertSide.WITHDRAW,
    marketAddress: market.marketAddress,
    inputToken: market.ptToken,
    outputToken: outputTokenAddress,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: isRedeemable ? ptBalance : undefined,
    quote,
    slippage,
    enabled: isRedeemable,
    shouldUseBatch,
    // Forward wagmi's write variables so the approve leg reports action 'approve'.
    onMutate: variables => txCallbacks.onMutate(variables),
    onStart: hash => txCallbacks.onStart(hash),
    onSuccess: hash => {
      mutatePtBalances();
      txCallbacks.onSuccess(hash);
    },
    onError: (err, hash) => txCallbacks.onError(err, hash)
  });

  // Map raw revert messages to user-friendly copy — shared with the buy/sell
  // modal so users see consistent guidance across all three flows. Only while
  // unprepared, so a recovered simulation drops the stale message.
  const prepareErrorMessage = useMemo<string | undefined>(
    () => (!writeHook.prepared ? pendlePrepareErrorMessage(writeHook.error?.message) : undefined),
    [writeHook.prepared, writeHook.error]
  );

  // The Network cell describes where the trade executes — the engine chain,
  // which the connected chain only matches while Pendle stays mainnet-gated.
  const chainId = useChainId();
  const engineChainId = familyMainnetId(chainId);
  const networkName = useNetworkName(engineChainId);

  // Steps mirror the engine's call count ([approve?, claim]), like the
  // buy/sell form — a first-time redeemer signs a PT approval first.
  const { address } = useConnection();
  const { data: allowance } = useTokenAllowance({
    chainId: engineChainId,
    contractAddress: market.ptToken,
    owner: address,
    spender: PENDLE_ROUTER_V4_ADDRESS[engineChainId]
  });
  const ptSymbol = `PT-${market.underlyingSymbol}`;
  const needsAllowance = allowance !== undefined && ptBalance > 0n && allowance < ptBalance;
  const steps = useMemo<TransactionStep[]>(() => {
    const claimStep = { label: t`Claim`, tokenSymbol: ptSymbol };
    return needsAllowance ? [{ label: t`Approve`, tokenSymbol: ptSymbol }, claimStep] : [claimStep];
  }, [needsAllowance, ptSymbol]);

  // Simulate on the engine chain (the calldata is mainnet's even when the
  // wallet sits elsewhere), and only while the modal is up — this hook mounts
  // once per matured card, and the estimate is only shown inside the modal.
  const feeCell = useModalFeeCell({
    calls: writeHook.calls ?? [],
    chainId: engineChainId,
    shouldUseBatch: !!writeHook.isBatch,
    enabled: isModalOpen && isRedeemable && !!quote
  });

  const transactionContent = useMemo(
    () => (
      <PendleRedeem
        market={market}
        ptBalance={ptBalance}
        outputTokenList={withdrawTokenList}
        selectedOutputToken={selectedOutputToken}
        onOutputTokenChange={setSelectedOutputToken}
        quote={quote}
        isFetchingQuote={isFetchingQuote}
        slippageDisplay={slippageDisplay}
        slippageMode={slippageMode}
        slippageAction={slippageAction}
        network={networkName}
        networkChainId={engineChainId}
        feeCell={feeCell}
      />
    ),
    [
      market,
      ptBalance,
      withdrawTokenList,
      selectedOutputToken,
      quote,
      isFetchingQuote,
      slippageDisplay,
      slippageMode,
      slippageAction,
      networkName,
      engineChainId,
      feeCell
    ]
  );

  const confirmDisabled = !writeHook.prepared || isFetchingQuote || writeHook.isLoading;

  // Indirect onConfirm through a ref — the stored onConfirm can't be
  // live-updated, but the ref always points at the latest writeHook.execute.
  const executeRef = useRef<() => void>(() => undefined);
  executeRef.current = () => writeHook.execute();

  // USD notional for the enhanced-screening threshold (APP-517): the valued
  // output leg, live across output-token/quote changes (pushed by the effect
  // below). A non-empty redeem whose leg can't be valued yet (quote or price
  // missing) is `undefined` — unknown, treated as above-threshold.
  const usdValue = useMemo(() => {
    const leg = pendleNonPtLeg('redeem', {
      originSymbol: ptToken.symbol,
      targetSymbol: selectedOutputToken.symbol,
      amountInBigint: ptBalance,
      amountOutBigint: quote?.amountOut ?? 0n,
      fromDecimals: market.underlyingDecimals,
      toDecimals: getTokenDecimals(selectedOutputToken, mainnet.id)
    });
    if (leg.amount === 0) return ptBalance > 0n ? undefined : 0;
    return valueUsd(leg.symbol, leg.amount);
  }, [ptToken, selectedOutputToken, ptBalance, quote, market, valueUsd]);

  // `amount` = USD value of the redeemed output leg, negative so dashboard
  // tiles filtering `properties.amount < 0` count redeem as a withdrawal
  // alongside SELL; omitted when no price is available rather than emit a
  // wrong-unit number. amountFrom/amountTo in `data` keep the raw counts.
  // Memoized so the launch seeds it and the live-update effect keeps it
  // fresh — the output token stays changeable after launch (APP-444 B14).
  const analytics = useMemo(() => {
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
    const leg = pendleNonPtLeg('redeem', {
      originSymbol: ptToken.symbol,
      targetSymbol: selectedOutputToken.symbol,
      amountInBigint: ptBalance,
      amountOutBigint: quote?.amountOut ?? 0n,
      fromDecimals: market.underlyingDecimals,
      toDecimals
    });
    const usd = valueUsd(leg.symbol, leg.amount);
    return {
      widgetName: 'fixed',
      flow: 'redeem',
      action: 'redeem',
      data: {
        ...data,
        ...(usd !== undefined ? { amount: -Math.abs(usd) } : {})
      }
    };
  }, [market, ptToken, ptBalance, selectedOutputToken, quote, slippage, valueUsd]);

  // Toast headlines — without them the toast falls back to the success
  // SUBTITLE above, a full sentence where the toast wants a label. Success
  // names the quoted receive leg ("Claimed 1,012.30 USDS"), formatted like the
  // review's receive row. Live like `usdValue`/`analytics` (the output token
  // stays changeable after launch) and frozen with them once the tx leaves
  // IDLE, so it states the quote the signed tx was built from — the app never
  // reads the fill off the receipt, so this is the quote, not the settled amount.
  const toast = useMemo(() => {
    const received = quote
      ? formatBigInt(quote.amountOut, {
          unit: getTokenDecimals(selectedOutputToken, mainnet.id),
          maxDecimals: 2
        })
      : undefined;
    return {
      loading: t`Claiming your matured position`,
      success: received ? t`Claimed ${received} ${selectedOutputToken.symbol}` : t`Position claimed`,
      error: t`Claim failed`
    };
  }, [quote, selectedOutputToken]);

  // Wrong chain: switch on click, then open — the Portfolio supply actions'
  // pattern (usePortfolioSupplyActions). The auto flags make the shell toast
  // explain the change; a rejected switch opens nothing and stays retryable.
  const chains = useChains();
  const onPendleChain = isPendleChain(chainId);
  const isSafeWallet = useIsSafeWallet();
  const { switchChainAsync } = useSwitchChain();
  const { setIsAutoSwitching, setAutoSwitchIntent } = useNetworkSwitch();
  const { trackNetworkSwitchRequested, trackNetworkSwitchCompleted } = useAppAnalytics();
  // A Safe can't switch networks from the dapp (APP-486) — the cards disable
  // Claim and explain instead of offering a click that always fails.
  const switchBlocked = !onPendleChain && isSafeWallet;

  const openRedeemModal = useCallback(async () => {
    if (!onPendleChain) {
      if (isSafeWallet) return;
      // The mainnet-family target, preferring the fork in dev configs —
      // auto-switching a dev wallet onto real Ethereum would mean real fees.
      const requiredChainId = chains.find(c => isTestnetId(c.id))?.id ?? mainnet.id;
      setAutoSwitchIntent(Intent.FIXED_INTENT);
      setIsAutoSwitching(true);
      trackNetworkSwitchRequested({
        source: 'pendle_claim',
        fromChainId: chainId,
        toChainId: requiredChainId
      });
      try {
        await switchChainAsync({ chainId: requiredChainId });
      } catch (error) {
        trackNetworkSwitchCompleted({
          source: 'pendle_claim',
          fromChainId: chainId,
          toChainId: requiredChainId,
          status: isUserRejectedRequestError(error) ? 'rejected' : 'error'
        });
        setIsAutoSwitching(false);
        setAutoSwitchIntent(null);
        return;
      }
      trackNetworkSwitchCompleted({
        source: 'pendle_claim',
        fromChainId: chainId,
        toChainId: requiredChainId,
        status: 'success'
      });
    }
    launch({
      usdValue,
      // Pendle redemption is mainnet-only — guard the modal off any L2 (APP-528).
      supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
      title: t`Claim matured position`,
      transactionTitle: t`Confirm in the wallet`,
      subtitles: {
        loading: t`Your claim is being processed on the blockchain. Please wait.`,
        success: t`You've successfully claimed your matured position.`,
        error: t`An error occurred while claiming your matured position.`
      },
      toast,
      transactionContent,
      errorMessage: prepareErrorMessage,
      steps,
      confirmLabel: t`Claim`,
      confirmDisabled,
      onConfirm: () => executeRef.current(),
      sessionId,
      analytics
    });
  }, [
    onPendleChain,
    isSafeWallet,
    chains,
    chainId,
    setAutoSwitchIntent,
    setIsAutoSwitching,
    trackNetworkSwitchRequested,
    trackNetworkSwitchCompleted,
    switchChainAsync,
    launch,
    transactionContent,
    prepareErrorMessage,
    steps,
    confirmDisabled,
    sessionId,
    analytics,
    usdValue,
    toast
  ]);

  useEffect(() => {
    // Freeze once the flow leaves IDLE (same as useModalEntryBody): the quote
    // repolls mid-flight and must not rewrite the blob the signed tx started
    // with — and a drifted `usdValue` could downgrade the screening tier a
    // retry is gated on (APP-517). Pushes resume when a failure returns to IDLE.
    if (!isModalOpen || txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      transactionContent,
      errorMessage: prepareErrorMessage,
      steps,
      confirmDisabled,
      analytics,
      usdValue,
      toast
    });
  }, [
    isModalOpen,
    txStatus,
    sessionId,
    updateModalContent,
    transactionContent,
    prepareErrorMessage,
    steps,
    confirmDisabled,
    analytics,
    usdValue,
    toast
  ]);

  return {
    openRedeemModal,
    isRedeemable,
    isPrepared: writeHook.prepared,
    onPendleChain,
    switchBlocked,
    ptBalance,
    error: writeHook.error
  };
}
