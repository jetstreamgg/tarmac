import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { mainnet } from 'viem/chains';
import { formatUnits, parseUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  getTokenDecimals,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useAllPendleMarketsHistory,
  useBatchPendleConvert,
  useIsBatchSupported,
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
import {
  chainId as chainIdMap,
  formatBigInt,
  formatDecimalPercentage,
  formatNumber,
  isTestnetId
} from '@/utils';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { NetworkFeeValue, useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { WidgetAnalyticsEventType, type WidgetAnalyticsEvent } from '@/widgets/shared/types/analyticsEvents';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SlippageMenu } from '@/components/ui/SlippageMenu';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { pendlePrepareErrorMessage } from '../utils/prepareErrorMessage';

export type PendleModalFlow = 'supply' | 'withdraw';

const NO_VALUE = '–';

function Row({ label, value, dataTestId }: { label: ReactNode; value: ReactNode; dataTestId?: string }) {
  return (
    <div className="flex items-center justify-between" data-testid={dataTestId}>
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text text-sm font-medium">{value}</span>
    </div>
  );
}

/** Parse a human amount into wei; malformed input normalizes to 0n. */
function parseAmount(value: string, decimals: number): bigint {
  if (!value) return 0n;
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Editable body for the Pendle "Supply to / Withdraw from {market}" modals (E1),
 * mounted as the shared modal's background content — the Pendle analogue of
 * VaultModalForm. One body, two flows: supply (buy PT with a chosen input
 * token) and withdraw (sell PT into a chosen output token). Quote + calldata
 * run through the untouched engine (`useQuotePendleConvert` /
 * `useBatchPendleConvert` → `buildVerifiedArgs`); this is presentation + the
 * legacy analytics event set, fired here with live amounts for exact parity
 * with the retired PendleWidget orchestration.
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

  const [value, setValue] = useState('');
  const amount = parseAmount(value, inputDecimals);

  const { data: walletBalance, refetch: refetchWalletBalance } = useTokenBalance({
    address,
    chainId: balanceChainId,
    token: selectedToken.address[balanceChainId]
  });
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const available = isSupply ? (walletBalance?.value ?? 0n) : (ptBalances?.[market.marketAddress] ?? 0n);

  const insufficient = amount > available;
  const amountReady = isConnected && amount > 0n && !insufficient;

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
  const engineChainId = isTestnetId(chainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const inputTokenAddress = isSupply ? selectedAddress : market.ptToken;
  const inputSymbol = isSupply ? selectedToken.symbol : ptToken.symbol;
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

  const { data: quote, isLoading: isFetchingQuote } = useQuotePendleConvert({
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

  // Review-viewed parity: this editable entry is the review surface — fire once
  // when the modal body mounts (the legacy widget fired it entering review).
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

  const { txCallbacks, updateModalContent } = useTransaction();
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
    onMutate: () => {
      txCallbacks.onMutate();
      fireAnalytics({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action: mainAction,
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

  const prepareErrorMessage = useMemo(
    () => pendlePrepareErrorMessage(writeHook.error?.message),
    [writeHook.error]
  );

  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee, error: networkFeeError } = useNetworkFee({
    calls: writeHook.calls ?? [],
    chainId,
    shouldUseBatch: !!writeHook.isBatch,
    enabled: amountReady
  });

  const bundleState = useBundleFeeState((writeHook.calls ?? []).length, networkFee, !!networkFeeError);

  const confirmDisabled = !amountReady || !writeHook.prepared || isFetchingQuote;

  // Memoized: useModalEntryBody lists this as an effect dep, and every
  // updateModalContent push re-renders the provider — a fresh element per
  // render would loop that effect (max-update-depth on open).
  const transactionScreenContent = useMemo(
    () => (
      <span className="text-textSecondary text-sm">
        {isSupply ? (
          <Trans>
            Supplying {value || '0'} {selectedToken.symbol}
          </Trans>
        ) : (
          <Trans>
            Withdrawing {value || '0'} {ptToken.symbol}
          </Trans>
        )}
      </span>
    ),
    [isSupply, value, selectedToken.symbol, ptToken.symbol]
  );

  const renderInSlot = useModalEntryBody({
    sessionId,
    execute: writeHook.execute,
    confirmDisabled,
    transactionScreenContent,
    steps
  });

  // The slippage gear lives in the modal header but must share this form's
  // slippage state (it feeds the live quote), so it's pushed from here.
  const rightHeaderComponent = useMemo(
    () => (
      <SlippageMenu
        value={slippage}
        defaultValue={defaultSlippage}
        onChange={setSlippage}
        dataTestId="pendle-slippage-menu"
      />
    ),
    [slippage, defaultSlippage, setSlippage]
  );
  useEffect(() => {
    updateModalContent(sessionId, { rightHeaderComponent });
  }, [sessionId, rightHeaderComponent, updateModalContent]);

  const setMaxAmount = () => setValue(formatUnits(available, inputDecimals));

  const availableLabel = `${formatBigInt(available, { unit: inputDecimals, maxDecimals: 2 })} ${
    isSupply ? selectedToken.symbol : ptToken.symbol
  }`;

  const receiveValue = quote
    ? `${formatBigInt(quote.amountOut, { unit: isSupply ? ptDecimals : selectedDecimals, maxDecimals: 2 })} ${
        isSupply ? ptToken.symbol : selectedToken.symbol
      }`
    : NO_VALUE;

  const body = (
    <div className="flex flex-col gap-3" data-testid={`pendle-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="text-text w-full bg-transparent text-2xl font-medium outline-none"
          data-testid="pendle-modal-amount-input"
        />
        <Button
          variant="secondary"
          className="h-8 shrink-0 rounded-full px-3 text-xs"
          onClick={setMaxAmount}
          data-testid="pendle-modal-max"
        >
          <Trans>Max</Trans>
        </Button>
        {isSupply ? (
          tokenOptions.length > 1 ? (
            <Select
              value={selectedToken.symbol}
              onValueChange={symbol => {
                const next = tokenOptions.find(option => option.symbol === symbol);
                if (next) setSelectedToken(next);
              }}
            >
              <SelectTrigger
                aria-label={t`Select token`}
                data-testid="pendle-modal-token-select"
                className={cn(
                  buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
                  'h-auto w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
                )}
              >
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <TokenIcon
                      token={{ symbol: selectedToken.symbol }}
                      width={20}
                      showChainIcon={false}
                      className="h-5 w-5"
                    />
                    {selectedToken.symbol}
                  </span>
                </SelectValue>
              </SelectTrigger>
              {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
              <SelectContent>
                {tokenOptions.map(option => (
                  <SelectItem key={option.symbol} value={option.symbol}>
                    <span className="flex items-center gap-1.5">
                      <TokenIcon
                        token={{ symbol: option.symbol }}
                        width={20}
                        showChainIcon={false}
                        className="h-5 w-5"
                      />
                      {option.symbol}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-text flex shrink-0 items-center gap-1.5 font-medium">
              <TokenIcon
                token={{ symbol: selectedToken.symbol }}
                width={20}
                showChainIcon={false}
                className="h-5 w-5"
              />
              {selectedToken.symbol}
            </span>
          )
        ) : (
          <span className="text-text flex shrink-0 items-center gap-1.5 font-medium">
            <TokenIcon
              token={{ symbol: ptToken.symbol }}
              width={20}
              showChainIcon={false}
              className="h-5 w-5"
            />
            {ptToken.symbol}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-textSecondary text-xs">
          <Trans>Available</Trans>
        </span>
        <span className="text-textSecondary text-xs">{availableLabel}</span>
      </div>

      {insufficient && (
        <p className="text-error text-sm" data-testid="pendle-modal-insufficient">
          <Trans>Insufficient funds</Trans>
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Row
          label={<Trans>You&apos;ll receive</Trans>}
          value={receiveValue}
          dataTestId="pendle-modal-receive"
        />
        {!isSupply && tokenOptions.length > 1 && (
          <Row
            label={<Trans>Receive as</Trans>}
            value={
              <Select
                value={selectedToken.symbol}
                onValueChange={symbol => {
                  const next = tokenOptions.find(option => option.symbol === symbol);
                  if (next) setSelectedToken(next);
                }}
              >
                <SelectTrigger
                  aria-label={t`Select token`}
                  data-testid="pendle-modal-token-select"
                  className={cn(
                    buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
                    'h-auto w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
                  )}
                >
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <TokenIcon
                        token={{ symbol: selectedToken.symbol }}
                        width={20}
                        showChainIcon={false}
                        className="h-5 w-5"
                      />
                      {selectedToken.symbol}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
                <SelectContent>
                  {tokenOptions.map(option => (
                    <SelectItem key={option.symbol} value={option.symbol}>
                      <span className="flex items-center gap-1.5">
                        <TokenIcon
                          token={{ symbol: option.symbol }}
                          width={20}
                          showChainIcon={false}
                          className="h-5 w-5"
                        />
                        {option.symbol}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        )}
        <Row
          label={<Trans>Fixed APY</Trans>}
          value={quote ? formatDecimalPercentage(quote.effectiveApy) : NO_VALUE}
        />
        <Row
          label={<Trans>Price impact</Trans>}
          value={quote ? formatDecimalPercentage(Math.abs(quote.priceImpact)) : NO_VALUE}
        />
        <Row
          label={<Trans>Max slippage</Trans>}
          value={`${formatNumber(slippage * 100, { maxDecimals: 2 })}%`}
        />
        <Row label={<NetworkFeeLabel />} value={<NetworkFeeValue fee={networkFee} state={bundleState} />} />
      </div>

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}

      {prepareErrorMessage && amountReady && (
        <p className="text-error text-sm" data-testid="pendle-modal-error">
          {prepareErrorMessage}
        </p>
      )}
    </div>
  );

  return renderInSlot(body);
}
