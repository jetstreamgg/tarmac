import { useEffect, useMemo, useRef, useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { mainnet } from 'viem/chains';
import { formatUnits } from 'viem';
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
  getTooltipById,
  PENDLE_HISTORY_REFRESH_MS,
  PendleFlow,
  pendleAnalyticsData,
  pendleNonPtLeg,
  PopoverInfo,
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
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField, type PercentPreset } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { usePendleSlippageCell } from '../hooks/usePendleSlippageCell';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { parseAmountInput } from '@/lib/amountInput';
import { NO_VALUE } from '@/lib/constants';
import { remainingDaysToMaturity } from '@/modules/earn/helpers/daysToMaturity';
import { pendlePrepareErrorMessage, pendleQuoteErrorMessage } from '../utils/prepareErrorMessage';
import { formatPriceImpact } from '../utils/priceImpact';
import { formatMaturity } from '@/modules/earn/helpers/formatMaturity';
import {
  buildPendleReviewRows,
  buildPendleSupplyEntryRows,
  buildPendleWithdrawEntryRows
} from './pendleModalRows';

export type PendleModalFlow = 'supply' | 'withdraw';

/**
 * Editable body for the Pendle "Supply to {market}" / "Early withdrawal"
 * modals (Figma 2193:73513 / 2193:73598 entries, 2193:73734 / 2193:73807
 * reviews), mounted as the shared modal's background content — the Pendle
 * analogue of VaultModalForm. One body, two flows: supply (buy PT with a
 * chosen input token) and withdraw (sell PT into a chosen output token; the
 * output choice lives in the grid's Withdrawal-token cell, the amount field's
 * pill is the fixed PT input). Quote + calldata run through the untouched
 * engine (`useQuotePendleConvert` / `useBatchPendleConvert` →
 * `buildVerifiedArgs`); this is presentation + the legacy analytics event set,
 * fired here with live amounts for exact parity with the retired PendleWidget
 * orchestration.
 *
 * Grid economics are per-order, from the PT-at-maturity model (1 PT redeems 1
 * underlying — 1 USDS on pegged markets — at expiry): the supply grids pin
 * this order's maturity claim (the quoted PT out) and its earnings over cost;
 * the withdraw grids state the early sell's forfeit directly ("Lost on early
 * withdrawal" = maturity value − receive now). Cross-token legs are compared
 * through the shared USD source (usePendleUsdValue) so sUSDS/USDC in- or
 * outputs don't mis-subtract.
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

  const { slippage, slippageDisplay, slippageMode, slippageAction } = usePendleSlippageCell(
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

  // Simulate on the engine chain — the calls are built for it (mainnet, or the
  // fork in dev), not necessarily the connected chain.
  const feeCell = useModalFeeCell({
    calls: writeHook.calls ?? [],
    chainId: engineChainId,
    shouldUseBatch: !!writeHook.isBatch,
    enabled: amountReady
  });

  const confirmDisabled = !amountReady || !writeHook.prepared || isFetchingQuote;

  // --- Grid economics (see the component doc for the per-order model). ---
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];
  const impliedApy = stats?.impliedApy;

  const expirySec = stats?.expirySec ?? market.expiry;
  const daysToMaturity = remainingDaysToMaturity(expirySec, Date.now());
  const claimDate = formatMaturity(expirySec);

  // Pegged markets (1 PT → 1 USDS at expiry) display position values as USDS.
  const displaySymbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;
  const ptSymbol = ptToken.symbol;

  const fmt = (n: number) => formatNumber(n, { maxDecimals: 2 });
  const inFloat = parseFloat(formatUnits(amount, inputDecimals));
  const outDecimals = isSupply ? ptDecimals : selectedDecimals;
  const outFloat = quote ? parseFloat(formatUnits(quote.amountOut, outDecimals)) : undefined;

  // Rate this order locks: the quote's effective APY once sized, the market
  // implied rate before an amount is entered.
  const rate = quote
    ? formatDecimalPercentage(quote.effectiveApy)
    : impliedApy !== undefined
      ? formatDecimalPercentage(impliedApy)
      : NO_VALUE;

  // Supply: this order's value at maturity is the quoted PT out; earnings are
  // that maturity value less today's cost, both legs through the USD source.
  const claimAtMaturity = isSupply && outFloat !== undefined ? fmt(outFloat) : NO_VALUE;
  const supplyMaturityUsd =
    isSupply && outFloat !== undefined ? valueUsd(displaySymbol, outFloat) : undefined;
  const supplyCostUsd = isSupply && quote ? valueUsd(selectedToken.symbol, inFloat) : undefined;
  const estEarnings =
    supplyMaturityUsd !== undefined && supplyCostUsd !== undefined
      ? fmt(supplyMaturityUsd - supplyCostUsd)
      : NO_VALUE;

  // Withdraw: what the early sell returns now, and what it forfeits vs holding
  // to maturity (the sold PT's maturity value less the receive-now leg).
  const receiveAmount = !isSupply && outFloat !== undefined ? fmt(outFloat) : NO_VALUE;
  const withdrawMaturityUsd = !isSupply && quote ? valueUsd(displaySymbol, inFloat) : undefined;
  const withdrawReceiveUsd =
    !isSupply && outFloat !== undefined ? valueUsd(selectedToken.symbol, outFloat) : undefined;
  // The cell states a forfeit: a favorable quote clamps to 0 and drops the
  // red trend — fmt's small-number branch would render a tiny gain as "<0.01".
  const lostValue =
    withdrawMaturityUsd !== undefined && withdrawReceiveUsd !== undefined
      ? withdrawMaturityUsd - withdrawReceiveUsd
      : undefined;
  const lost = lostValue !== undefined ? fmt(Math.max(0, lostValue)) : NO_VALUE;
  const lostTrend = lostValue !== undefined && lostValue >= 0.005;

  // The minimum the quote guarantees (PT on supply, output token on
  // withdraw) — floored, so the display never overstates it.
  const minReceived = quote
    ? formatNumber(parseFloat(formatUnits(quote.apiMinOut, outDecimals)), {
        maxDecimals: 2,
        roundingMode: 'floor'
      })
    : NO_VALUE;

  // The Network cells describe where the trade executes — the engine chain,
  // which the connected chain only matches while Pendle stays mainnet-gated.
  const networkName = useNetworkName(engineChainId);

  const lostTooltip = getTooltipById('early-withdrawal-loss');
  const entryRows = isSupply
    ? buildPendleSupplyEntryRows({
        rate,
        claimDate,
        displaySymbol,
        claimAtMaturity,
        estEarnings,
        daysToMaturity,
        network: networkName,
        networkChainId: engineChainId,
        networkFee: feeCell.fee?.formatted ?? NO_VALUE
      })
    : buildPendleWithdrawEntryRows({
        tokenSelector: (
          <TokenSelectorPill
            tokens={tokenOptions}
            selected={selectedToken}
            onSelect={setSelectedToken}
            testId="pendle-modal-token-select"
          />
        ),
        receiveAmount,
        receiveSymbol: selectedToken.symbol,
        lost,
        lostTrend,
        displaySymbol,
        lostInfo: lostTooltip ? (
          <PopoverInfo title={lostTooltip.title} description={lostTooltip.tooltip} iconSize={12} />
        ) : undefined,
        network: networkName,
        networkChainId: engineChainId,
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

  // Review breakdown (Figma 2193:73734 supply / 2193:73807 withdrawal): the
  // amount hero over the review grid. The withdraw review leads with what the
  // sell returns ("You'll receive now", the comp's hero) rather than the PT
  // input, which moves into the grid's Withdrawal-amount cell. Scalar deps
  // keep the memo stable across unrelated renders (matches the savings/vault
  // forms).
  // Sign-flipped like the legacy modal and the redeem sheet, so positive reads
  // as a cost to the user (PR #1781 review) — see formatPriceImpact.
  const priceImpactDisplay = formatPriceImpact(quote?.priceImpact) ?? NO_VALUE;
  const selectedSymbol = selectedToken.symbol;
  const transactionContent = useMemo(
    () => (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`pendle-modal-${flow}-review`}>
        {isSupply ? (
          transactionScreenContent
        ) : (
          <TransactionAmountHero
            label={t`You'll receive now`}
            amount={receiveAmount}
            symbol={selectedSymbol}
            dataTestId="pendle-receive-summary"
          />
        )}
        <ModalSummaryGrid
          rows={toGridCells(
            buildPendleReviewRows(flow, {
              displaySymbol,
              claimAtMaturity,
              claimDate,
              estEarnings,
              daysToMaturity,
              rate,
              withdrawalAmount: amountDisplay,
              ptSymbol,
              receiveSymbol: selectedSymbol,
              minReceived,
              // Figma 859:41308: "Pendle sUSDS (PT-sUSDS)" — the PT naming
              // convention, not the market's marketing name ("Fixed Yield").
              product: `Pendle ${market.underlyingSymbol} (PT-${market.underlyingSymbol})`,
              productSymbol: market.underlyingSymbol,
              withdrawal: i18n._(withdrawalWording('fixed', flow)),
              slippage: slippageDisplay,
              slippageMode,
              priceImpact: priceImpactDisplay,
              slippageAction,
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
      isSupply,
      transactionScreenContent,
      displaySymbol,
      claimAtMaturity,
      claimDate,
      estEarnings,
      daysToMaturity,
      rate,
      amountDisplay,
      ptSymbol,
      receiveAmount,
      selectedSymbol,
      minReceived,
      market.underlyingSymbol,
      slippageDisplay,
      slippageMode,
      slippageAction,
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
        label={isSupply ? <Trans>Amount</Trans> : <Trans>{ptSymbol} amount</Trans>}
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
          isSupply ? (
            <TokenSelectorPill
              tokens={tokenOptions}
              selected={selectedToken}
              onSelect={setSelectedToken}
              testId="pendle-modal-token-select"
            />
          ) : (
            // The withdraw input is the PT itself (Figma 2193:73598 draws a
            // static PT-sUSDS chip); the output choice lives in the grid's
            // Withdrawal-token cell.
            <TokenSelectorPill tokens={[ptToken]} selected={ptToken} testId="pendle-modal-pt-token" />
          )
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
