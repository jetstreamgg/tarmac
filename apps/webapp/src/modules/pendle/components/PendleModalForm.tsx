import { useEffect, useMemo, useRef, useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
import { format } from 'date-fns';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  getTokenDecimals,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useAllPendleMarketsHistory,
  useBatchPendleConvert,
  useIsBatchSupported,
  usePendleMarketsApiData,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  useTokenAllowance,
  useTokenBalance,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import {
  PENDLE_HISTORY_REFRESH_MS,
  PendleFlow,
  pendleAnalyticsData,
  pendleNonPtLeg,
  usePendleSlippage,
  usePendleTokens,
  usePendleUsdValue,
  type PendleAnalyticsSide
} from '@/widgets';
import { familyMainnetId, formatBigInt, formatDecimalPercentage, formatNumber, isTestnetId } from '@/utils';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { WidgetAnalyticsEventType, type WidgetAnalyticsEvent } from '@/widgets/shared/types/analyticsEvents';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';
import { SlippageMenu } from '@/components/ui/SlippageMenu';
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField, type PercentPreset } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { parseAmountInput } from '@/lib/amountInput';
import { NO_VALUE } from '@/lib/constants';
import { remainingDaysToMaturity } from '@/modules/earn/helpers/daysToMaturity';
import { pendlePrepareErrorMessage, pendleQuoteErrorMessage } from '../utils/prepareErrorMessage';
import { formatPriceImpact } from '../utils/priceImpact';
import { buildPendleEntryRows, buildPendleReviewRows } from './pendleModalRows';

export type PendleModalFlow = 'supply' | 'withdraw';

/**
 * Editable body for the Pendle "Supply to / Withdraw from {market}" modals
 * (Figma 859:41118 / 859:41473 entries, 859:41264 / 859:41679 reviews),
 * mounted as the shared modal's background content — the Pendle analogue of
 * VaultModalForm. One body, two flows: supply (buy PT with a chosen input
 * token) and withdraw (sell PT into a chosen output token). Quote + calldata
 * run through the untouched engine (`useQuotePendleConvert` /
 * `useBatchPendleConvert` → `buildVerifiedArgs`); this is presentation + the
 * legacy analytics event set, fired here with live amounts for exact parity
 * with the retired PendleWidget orchestration.
 *
 * Position economics for the grid derive from the PT-at-maturity model:
 * "You'll claim" is the PT balance (1 PT redeems 1 underlying at expiry),
 * "Supply" is its present value at the market's implied rate, and earnings are
 * the difference — a self-consistent triple that needs no cost-basis history
 * (none exists for active positions; see PendlePositionCard).
 */
export function PendleModalForm({
  sessionId,
  flow,
  market
}: {
  sessionId: string;
  flow: PendleModalFlow;
  market: PendleMarketConfig;
}) {
  const chainId = useChainId();
  const { i18n } = useLingui();
  const { isConnected, address } = useConnection();
  const isSupply = flow === 'supply';
  const side = isSupply ? PendleConvertSide.BUY : PendleConvertSide.WITHDRAW;

  const { ptToken, supplyTokenList, withdrawTokenList } = usePendleTokens(market);
  const tokenOptions = isSupply ? supplyTokenList : withdrawTokenList;
  const [selectedToken, setSelectedToken] = useState<Token>(tokenOptions[0]);

  // Pendle markets are mainnet-only; balances follow the fork in dev mode.
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;
  const selectedAddress = selectedToken.address[mainnet.id] as `0x${string}`;
  const selectedDecimals = getTokenDecimals(selectedToken, balanceChainId);
  // PT decimals match the underlying's (Pendle convention).
  const ptDecimals = market.underlyingDecimals;
  const inputDecimals = isSupply ? selectedDecimals : ptDecimals;
  const inputSymbol = isSupply ? selectedToken.symbol : ptToken.symbol;

  const [value, setValue] = useState('');
  const amount = parseAmountInput(value, inputDecimals);

  const { data: walletBalance, refetch: refetchWalletBalance } = useTokenBalance({
    address,
    chainId: balanceChainId,
    token: selectedToken.address[balanceChainId]
  });
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const available = isSupply ? (walletBalance?.value ?? 0n) : ptBalance;

  // Never validate against the unresolved balance's 0n fallback.
  const balanceKnown = isSupply ? walletBalance !== undefined : ptBalances !== undefined;
  const insufficient = balanceKnown && amount > available;
  const amountReady = isConnected && amount > 0n && balanceKnown && !insufficient;

  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage(
    isSupply ? PendleFlow.BUY : PendleFlow.WITHDRAW
  );
  const valueUsd = usePendleUsdValue();

  // Honour the user's batch toggle: bundle approve+convert into one EIP-5792
  // call only when opted in AND supported (mirrors useSavingsLaunch /
  // useVaultLaunch). useTransactionFlow additionally gates on calls.length > 1.
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported;

  // READ ONLY — labels the approve step only; the approve/convert calls live in
  // useBatchPendleConvert. Same inputs as the engine's own allowance read (input
  // token → Pendle router on the engine's chain) so TanStack dedupes the two.
  const engineChainId = familyMainnetId(chainId);
  const inputTokenAddress = isSupply ? selectedAddress : market.ptToken;
  const { data: allowance } = useTokenAllowance({
    chainId: engineChainId,
    contractAddress: inputTokenAddress,
    owner: address,
    spender: PENDLE_ROUTER_V4_ADDRESS[engineChainId]
  });
  const needsAllowance = allowance !== undefined && amount > 0n && allowance < amount;

  // Steps mirror the engine's call count ([approve?, convert]) so the
  // indicator advances in lockstep with the sequential flow's onMutate bumps.
  const steps = useMemo<TransactionStep[]>(() => {
    const convertStep = { label: isSupply ? t`Supply` : t`Withdraw`, tokenSymbol: inputSymbol };
    return needsAllowance ? [{ label: t`Approve`, tokenSymbol: inputSymbol }, convertStep] : [convertStep];
  }, [isSupply, needsAllowance, inputSymbol]);

  const {
    data: quote,
    isLoading: isFetchingQuote,
    error: quoteError
  } = useQuotePendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken: isSupply ? selectedAddress : market.ptToken,
    outputToken: isSupply ? market.ptToken : selectedAddress,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: amount > 0n ? amount : undefined,
    slippage,
    enabled: amount > 0n
  });

  // --- Analytics: the legacy PendleWidget event set, with live amounts. ---
  const onAnalyticsEvent = useWidgetAnalytics('fixed', chainId);
  const mainAction: 'supply' | 'withdraw' = isSupply ? 'supply' : 'withdraw';
  const analyticsSide: PendleAnalyticsSide = isSupply ? 'buy' : 'sell';
  const originToken = isSupply ? selectedToken : ptToken;
  const targetToken = isSupply ? ptToken : selectedToken;
  const fromDecimals = isSupply ? selectedDecimals : ptDecimals;
  const toDecimals = isSupply ? ptDecimals : selectedDecimals;

  // `amount` = USD value of the non-PT leg (input on buy, output on sell), so
  // sUSDS supplies don't mis-sum the inflow/outflow tiles. useWidgetAnalytics
  // applies the withdraw sign — pass positive magnitude.
  const leg = pendleNonPtLeg(analyticsSide, {
    originSymbol: originToken.symbol,
    targetSymbol: targetToken.symbol,
    amountInBigint: amount,
    amountOutBigint: quote?.amountOut ?? 0n,
    fromDecimals,
    toDecimals
  });
  const formattedAmount = valueUsd(leg.symbol, leg.amount);

  const buildData = () =>
    pendleAnalyticsData({
      market,
      side: analyticsSide,
      originToken,
      targetToken,
      amountFromBigint: amount,
      amountToBigint: quote?.amountOut ?? 0n,
      fromDecimals,
      toDecimals,
      slippage,
      quote,
      isBatchTx: shouldUseBatch
    });

  // Analytics must never break functionality.
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent(event);
    } catch {
      // swallow
    }
  };
  const fireAnalyticsRef = useRef(fireAnalytics);
  fireAnalyticsRef.current = fireAnalytics;

  // Review-viewed parity: fired once when the modal body mounts, matching the
  // shipped two-screen behavior (the legacy widget fired it entering review).
  const reviewFiredRef = useRef(false);
  useEffect(() => {
    if (reviewFiredRef.current) return;
    reviewFiredRef.current = true;
    fireAnalyticsRef.current({
      event: WidgetAnalyticsEventType.REVIEW_VIEWED,
      action: mainAction,
      flow: mainAction
    });
  }, [mainAction]);

  const { txCallbacks } = useTransaction();
  const { mutate: refreshPendleHistory } = useAllPendleMarketsHistory();

  const writeHook = useBatchPendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken: isSupply ? selectedAddress : market.ptToken,
    outputToken: isSupply ? market.ptToken : selectedAddress,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: amount > 0n ? amount : undefined,
    quote,
    slippage,
    enabled: amountReady && !!quote,
    shouldUseBatch,
    // This modal self-reports (it registers no `analytics` block with the
    // transaction context), so the approve leg is discriminated here.
    onMutate: variables => {
      txCallbacks.onMutate(variables);
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action: variables?.functionName === 'approve' ? 'approve' : mainAction,
        flow: mainAction,
        amount: formattedAmount,
        data: buildData()
      });
    },
    onStart: hash => txCallbacks.onStart(hash),
    onSuccess: hash => {
      mutatePtBalances();
      refetchWalletBalance();
      // Pendle's PnL indexer needs ~20s after the receipt lands to expose the
      // new row — see PENDLE_HISTORY_REFRESH_MS for measurements.
      setTimeout(refreshPendleHistory, PENDLE_HISTORY_REFRESH_MS);
      txCallbacks.onSuccess(hash);
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
        action: mainAction,
        flow: mainAction,
        txHash: hash,
        amount: formattedAmount,
        data: buildData()
      });
    },
    onError: (err, hash) => {
      txCallbacks.onError(err, hash);
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
        action: mainAction,
        flow: mainAction,
        txHash: hash,
        error: err,
        amount: formattedAmount,
        data: buildData()
      });
    }
  });

  // Quote failures win over write-layer prepare failures — an outage or
  // no-route means there's nothing to prepare — but only once no usable quote
  // remains: a failed background poll while the previous quote is still within
  // TTL must not paint an outage banner over an enabled Confirm. The buy/sell
  // slippage control lives on the review screen (no header gear), hence the
  // location-specific hint.
  const quoteErrorMessage = useMemo(
    () => (quote ? undefined : pendleQuoteErrorMessage(quoteError?.message)),
    [quote, quoteError]
  );
  const prepareErrorMessage = useMemo(
    () =>
      !writeHook.prepared
        ? pendlePrepareErrorMessage(
            writeHook.error?.message,
            t`Current market price exceeds your slippage tolerance. Adjust slippage on the review screen, or wait for the quote to refresh.`
          )
        : undefined,
    [writeHook.prepared, writeHook.error]
  );
  const errorMessage = quoteErrorMessage ?? prepareErrorMessage;

  const feeCell = useModalFeeCell({
    calls: writeHook.calls ?? [],
    chainId,
    shouldUseBatch: !!writeHook.isBatch,
    enabled: amountReady
  });

  const confirmDisabled = !amountReady || !writeHook.prepared || isFetchingQuote;

  // --- Grid economics (see the component doc for the PT-at-maturity model). ---
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];
  const impliedApy = stats?.impliedApy;

  const expirySec = stats?.expirySec ?? market.expiry;
  const daysToMaturity = remainingDaysToMaturity(expirySec, Date.now());
  const claimDate = format(new Date(expirySec * 1000), 'd MMM yyyy');

  // Pegged markets (1 PT → 1 USDS at expiry) display position values as USDS.
  const displaySymbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;

  const claimBefore = parseFloat(formatUnits(ptBalance, ptDecimals));
  const ptDelta = isSupply
    ? parseFloat(formatUnits(quote?.amountOut ?? 0n, ptDecimals))
    : -parseFloat(formatUnits(amount, ptDecimals));
  const claimAfter = Math.max(0, claimBefore + ptDelta);

  // Present value discounts the maturity claim at the implied rate — the
  // "Supply" column; earnings-to-maturity are the complement.
  const discount = impliedApy !== undefined ? 1 / Math.pow(1 + impliedApy, daysToMaturity / 365) : undefined;
  const fmt = (n: number) => formatNumber(n, { maxDecimals: 2 });
  const pv = (claim: number) => (discount !== undefined ? fmt(claim * discount) : NO_VALUE);
  const earningsToMaturity = (claim: number) =>
    discount !== undefined ? fmt(claim * (1 - discount)) : NO_VALUE;

  const rateBefore = impliedApy !== undefined ? formatDecimalPercentage(impliedApy) : NO_VALUE;
  const rateAfter = quote ? formatDecimalPercentage(quote.effectiveApy) : rateBefore;
  const hasAmount = amount > 0n && !!quote;

  // The Network cells describe where the trade executes — the engine chain,
  // which the connected chain only matches while Pendle stays mainnet-gated.
  const networkName = useNetworkName(engineChainId);

  const entryRows = buildPendleEntryRows({
    rateBefore,
    rateAfter,
    network: networkName,
    networkChainId: engineChainId,
    displaySymbol,
    supplyBefore: pv(claimBefore),
    supplyAfter: pv(claimAfter),
    earningsBefore: earningsToMaturity(claimBefore),
    earningsAfter: earningsToMaturity(claimAfter),
    claimBefore: fmt(claimBefore),
    claimAfter: fmt(claimAfter),
    daysToMaturity,
    claimDate,
    hasAmount,
    networkFee: feeCell.fee?.formatted ?? NO_VALUE
  });

  const setMaxAmount = () => setValue(formatUnits(available, inputDecimals));
  const setPercentAmount = (pct: PercentPreset) => {
    if (pct >= 100) {
      setMaxAmount();
      return;
    }
    setValue(formatUnits((available * BigInt(pct)) / 100n, inputDecimals));
  };

  const amountDisplay = fmt(parseFloat(formatUnits(amount, inputDecimals)));

  // Amount hero shared by the review + wallet/status screens (Figma 859:41271 /
  // 859:41686), mirroring the savings/vault treatment.
  const heroLabel = isSupply ? t`Supply amount` : t`Withdrawal amount`;
  const transactionScreenContent = useMemo(
    () => (
      <TransactionAmountHero
        label={heroLabel}
        amount={amountDisplay}
        symbol={inputSymbol}
        dataTestId="pendle-amount-summary"
      />
    ),
    [heroLabel, amountDisplay, inputSymbol]
  );

  // Review breakdown (Figma 859:41264 supply / 859:41679 withdrawal): the
  // amount hero over the review grid. Scalar deps keep the memo stable across
  // unrelated renders (matches the savings/vault forms).
  const receiveAmount = quote
    ? fmt(parseFloat(formatUnits(quote.amountOut, isSupply ? ptDecimals : selectedDecimals)))
    : NO_VALUE;
  const slippageDisplay = `${formatNumber(slippage * 100, { maxDecimals: 2 })}%`;
  const slippageMode = slippage === defaultSlippage ? t`Auto` : t`Custom`;
  // Sign-flipped like the legacy modal and the redeem sheet, so positive reads
  // as a cost to the user (PR #1781 review) — see formatPriceImpact.
  const priceImpactDisplay = formatPriceImpact(quote?.priceImpact) ?? NO_VALUE;
  const claimAfterDisplay = fmt(claimAfter);
  const earningsAfterDisplay = earningsToMaturity(claimAfter);
  const selectedSymbol = selectedToken.symbol;
  const transactionContent = useMemo(
    () => (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`pendle-modal-${flow}-review`}>
        {transactionScreenContent}
        <ModalSummaryGrid
          rows={toGridCells(
            buildPendleReviewRows(flow, {
              displaySymbol,
              claimAfter: claimAfterDisplay,
              claimDate,
              earningsAfter: earningsAfterDisplay,
              daysToMaturity,
              receiveAmount,
              receiveSymbol: selectedSymbol,
              rate: rateAfter,
              // Figma 859:41308: "Pendle sUSDS (PT-sUSDS)" — the PT naming
              // convention, not the market's marketing name ("Fixed Yield").
              product: `Pendle ${market.underlyingSymbol} (PT-${market.underlyingSymbol})`,
              productSymbol: market.underlyingSymbol,
              withdrawal: i18n._(withdrawalWording('fixed', flow)),
              slippage: slippageDisplay,
              slippageMode,
              priceImpact: priceImpactDisplay,
              slippageAction: (
                <SlippageMenu
                  value={slippage}
                  defaultValue={defaultSlippage}
                  onChange={setSlippage}
                  triggerClassName="text-fgTertiary hover:text-fgPrimary data-[state=open]:text-fgPrimary p-0 [&>svg]:size-3.5"
                  dataTestId="pendle-slippage-menu"
                />
              ),
              network: networkName,
              networkChainId: engineChainId,
              networkFee: feeCell.fee?.formatted ?? NO_VALUE
            }),
            'pendle-modal-row',
            feeCell
          )}
          dividerClassName="h-6"
        />
      </div>
    ),
    [
      flow,
      transactionScreenContent,
      displaySymbol,
      claimAfterDisplay,
      claimDate,
      earningsAfterDisplay,
      daysToMaturity,
      receiveAmount,
      selectedSymbol,
      rateAfter,
      market.underlyingSymbol,
      market.name,
      slippageDisplay,
      slippageMode,
      slippage,
      defaultSlippage,
      setSlippage,
      priceImpactDisplay,
      networkName,
      engineChainId,
      feeCell
    ]
  );

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: writeHook.execute,
    confirmDisabled,
    errorMessage,
    transactionContent,
    transactionScreenContent,
    steps
  });

  const balanceDisplay = formatBigInt(available, { unit: inputDecimals, maxDecimals: 2 });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`pendle-modal-${flow}-form`}>
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol={inputSymbol}
        value={value}
        decimals={inputDecimals}
        onInput={setValue}
        disabled={!isConnected}
        balance={
          <>
            <Trans>Balance</Trans>: {isConnected && balanceKnown ? balanceDisplay : NO_VALUE}
          </>
        }
        onPercent={setPercentAmount}
        selector={
          <TokenSelectorPill
            tokens={tokenOptions}
            selected={selectedToken}
            onSelect={setSelectedToken}
            testId="pendle-modal-token-select"
          />
        }
        error={
          insufficient ? (
            <Text className="text-error text-sm" data-testid="pendle-modal-insufficient">
              <Trans>Insufficient funds</Trans>
            </Text>
          ) : undefined
        }
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="pendle-modal-amount-input"
        maxTestId="pendle-modal-max"
      />

      <ModalSummaryGrid rows={toGridCells(entryRows, 'pendle-modal-row', feeCell)} dividerClassName="h-8" />

      {feeCell.state.promoVisible && <BundleSavingsPromo saving={feeCell.fee!.batchSaving!} />}
    </div>
  );

  return renderInSlot(body);
}
