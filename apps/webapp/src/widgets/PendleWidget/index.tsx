import { useContext, useEffect, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useChainId } from 'wagmi';
import { useConnection } from 'wagmi';
import {
  getTokenDecimals,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useBatchPendleConvert,
  useIsBatchSupported,
  useQuotePendleConvert,
  useTokenAllowance,
  useTokenBalance,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { isTestnetId } from '@/utils';
import { useDebounce, useIsSafeWallet } from '@/hooks';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/widgets/components/ui/button';
import { WidgetContainer } from '@/widgets/shared/components/ui/widget/WidgetContainer';
import { WidgetButtons } from '@/widgets/shared/components/ui/widget/WidgetButtons';
import { Heading, Text } from '@/widgets/shared/components/ui/Typography';
import { HStack } from '@/widgets/shared/components/ui/layout/HStack';
import { withWidgetProvider } from '@/widgets/shared/hocs/withWidgetProvider';
import { CardAnimationWrapper } from '@/widgets/shared/animation/Wrappers';
import { AnimatePresence } from 'motion/react';
import { TxStatus } from '@/widgets/shared/constants';
import { WidgetContext } from '@/widgets/context/WidgetContext';
import { WidgetProps, WidgetState } from '@/widgets/shared/types/widgetState';
import { WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { mainnet } from 'viem/chains';
import { PendleAction, PendleFlow, PendleScreen } from './lib/constants';
import { usePendleSlippage } from './hooks/usePendleSlippage';
import { usePendleTokens } from './hooks/usePendleTokens';
import { usePendleTransactionCallbacks } from './hooks/usePendleTransactionCallbacks';
import { usePendleUsdValue } from './hooks/usePendleUsdValue';
import { pendleAnalyticsData } from './lib/pendleAnalyticsData';
import { pendleNonPtLeg } from './lib/pendleUsdValue';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { PendleConfigMenu } from './components/PendleConfigMenu';
import { PendlePoweredBy } from './components/PendlePoweredBy';
import { PendleTransactionReview } from './components/PendleTransactionReview';
import { PendleTransactionStatus } from './components/PendleTransactionStatus';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useNotification } from '@/modules/app/hooks/useNotification';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';

export type PendleWidgetProps = WidgetProps & {
  /** Selected Pendle market — passed in by the webapp module after URL-driven selection. */
  market: PendleMarketConfig;
  /** When provided, renders a "Back to Fixed Yield" link above the heading. The webapp module
   * uses this to clear the market query params and return to the overview list. */
  onBackToPendle?: () => void;
};

const PendleWidgetWrapped = ({ market, rightHeaderComponent, onBackToPendle }: PendleWidgetProps) => {
  const onConnect = useCustomConnectModal();
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const onNotification = useNotification();
  const chainId = useChainId();
  const onAnalyticsEvent = useWidgetAnalytics('fixed', chainId);
  // Values the user's non-PT leg in USD for the analytics `amount` property —
  // sUSDS isn't $1, so a token count would mis-sum the inflow/outflow tiles.
  const valueUsd = usePendleUsdValue();
  const { address, isConnected, isConnecting } = useConnection();
  const { isConnectedAndAcceptedTerms: enabled } = useConnectedContext();
  const { onExternalLinkClicked } = useConfigContext();
  const isConnectedAndEnabled = isConnected && enabled;

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    txStatus,
    setTxStatus,
    setShowStepIndicator,
    setExternalLink,
    widgetState,
    setWidgetState
  } = useContext(WidgetContext);
  const isSafeWallet = useIsSafeWallet();
  const linguiCtx = useLingui();

  const [amount, setAmount] = useState<bigint>(0n);
  const debouncedAmount = useDebounce(amount);

  const flow = (widgetState.flow as PendleFlow | null) ?? PendleFlow.BUY;
  const screen = (widgetState.screen as PendleScreen | null) ?? PendleScreen.ACTION;
  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage(flow);

  // Initialize widgetState (matches the SavingsWidget pattern). Re-runs when
  // the connection state changes — disconnecting mid-flow rolls the user back
  // to the ACTION screen.
  useEffect(() => {
    setWidgetState({
      flow: PendleFlow.BUY,
      action: isConnectedAndEnabled ? PendleAction.BUY : null,
      screen: PendleScreen.ACTION
    });
  }, [isConnectedAndEnabled, setWidgetState]);

  const setScreen = (next: PendleScreen) => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: next }));
  };

  const setFlow = (next: PendleFlow) => {
    setAmount(0n);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      flow: next,
      action: next === PendleFlow.BUY ? PendleAction.BUY : PendleAction.WITHDRAW,
      screen: PendleScreen.ACTION
    }));
  };

  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { underlyingToken, ptToken, supplyTokenList, withdrawTokenList } = usePendleTokens(market);

  const [selectedSupplyToken, setSelectedSupplyToken] = useState<Token>(underlyingToken);
  const [selectedWithdrawOutToken, setSelectedWithdrawOutToken] = useState<Token>(withdrawTokenList[0]);

  const handleSupplyTokenChange = (next: Token) => {
    const prevDecimals = getTokenDecimals(selectedSupplyToken, mainnet.id);
    const nextDecimals = getTokenDecimals(next, mainnet.id);
    if (amount > 0n && prevDecimals !== nextDecimals) {
      setAmount(parseUnits(formatUnits(amount, prevDecimals), nextDecimals));
    }
    setSelectedSupplyToken(next);
  };

  // The "user-side" token for the active flow — input on BUY, output on SELL.
  const userSideToken = flow === PendleFlow.BUY ? selectedSupplyToken : selectedWithdrawOutToken;
  const userSideTokenAddress = userSideToken.address[mainnet.id] as `0x${string}`;

  const inputToken = flow === PendleFlow.BUY ? userSideTokenAddress : market.ptToken;
  const outputToken = flow === PendleFlow.BUY ? market.ptToken : userSideTokenAddress;
  const side = flow === PendleFlow.BUY ? PendleConvertSide.BUY : PendleConvertSide.WITHDRAW;

  const originToken = flow === PendleFlow.BUY ? selectedSupplyToken : ptToken;
  const targetToken = flow === PendleFlow.BUY ? ptToken : selectedWithdrawOutToken;

  // Balance for the input side: BUY → user-selected supply token; SELL → PT.
  const { data: inputBalance, refetch: refetchInputBalance } = useTokenBalance({
    chainId: balanceChainId,
    address,
    token: inputToken
  });

  // Balance for the output side: BUY → PT; SELL → user-selected output token.
  // Read-only TokenInputs render "No wallet connected" when balance is
  // undefined, so we query this even though the user isn't editing it.
  const { data: outputBalance, refetch: refetchOutputBalance } = useTokenBalance({
    chainId: balanceChainId,
    address,
    token: outputToken
  });

  const { data: ptBalance, refetch: refetchPtBalance } = useTokenBalance({
    chainId: balanceChainId,
    address,
    token: market.ptToken
  });

  // Allowance for the input token (underlying for Buy, PT for Withdraw) → router.
  // Mirrors the check inside useBatchPendleConvert; React Query cache dedupes.
  const { data: allowance } = useTokenAllowance({
    chainId: balanceChainId,
    contractAddress: inputToken,
    owner: address,
    spender: PENDLE_ROUTER_V4_ADDRESS[balanceChainId]
  });
  const needsAllowance = !!(allowance === undefined || allowance < debouncedAmount);
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported && needsAllowance;

  const debounceSettled = amount === debouncedAmount;
  const {
    data: quote,
    isLoading: isFetchingQuote,
    error: quoteError
  } = useQuotePendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: debouncedAmount > 0n ? debouncedAmount : undefined,
    slippage,
    enabled: debouncedAmount > 0n && debounceSettled
  });

  // Map raw Pendle /convert errors (HTTP failures, malformed quotes, no
  // routes, network errors) to user-friendly copy.
  const quoteErrorMessage = useMemo<string | undefined>(() => {
    const raw = quoteError?.message;
    if (!raw) return undefined;
    // Pendle rejects inputs valued below $0.01 with a 400. Surfacing the
    // generic "service unavailable" copy would be misleading — the user
    // just needs to enter a larger amount.
    if (/input valuation is too low/i.test(raw)) {
      return t`Input amount is too low. Please try a larger amount.`;
    }
    if (/no routes/i.test(raw)) {
      return t`No route available for this trade size. Try a different amount.`;
    }
    if (/malformed quote/i.test(raw)) {
      return t`Received an invalid quote from Pendle. Please try again.`;
    }
    if (/^Pendle \/convert \d+/i.test(raw)) {
      return t`Pendle's quote service is temporarily unavailable. Please try again.`;
    }
    return t`Couldn't fetch a quote from Pendle. Check your connection and try again.`;
  }, [quoteError]);

  // Surface quote errors as a toast.
  useEffect(() => {
    if (quoteErrorMessage) {
      onNotification?.({
        title: t`Error fetching quote`,
        description: quoteErrorMessage,
        status: TxStatus.ERROR
      });
    }
  }, [quoteErrorMessage, onNotification]);

  const insufficientFunds = useMemo(() => {
    if (!isConnectedAndEnabled || amount === 0n) return false;
    const balance = flow === PendleFlow.BUY ? inputBalance?.value : ptBalance?.value;
    return balance !== undefined && debouncedAmount > balance;
  }, [isConnectedAndEnabled, amount, debouncedAmount, flow, inputBalance, ptBalance]);

  const fromDecimals = getTokenDecimals(originToken, mainnet.id);
  const toDecimals = getTokenDecimals(targetToken, mainnet.id);

  const txCallbacks = usePendleTransactionCallbacks({
    flow,
    side,
    market,
    originToken,
    targetToken,
    amount: debouncedAmount,
    fromDecimals,
    toDecimals,
    slippage,
    quote,
    needsAllowance,
    shouldUseBatch,
    chainId,
    address,
    isSafeWallet,
    setTxStatus,
    setExternalLink,
    setWidgetState,
    refetchInputBalance,
    refetchOutputBalance,
    refetchPtBalance,
    onNotification,
    onAnalyticsEvent,
    valueUsd
  });

  const batchConvert = useBatchPendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: debouncedAmount > 0n ? debouncedAmount : undefined,
    quote,
    slippage,
    enabled: isConnectedAndEnabled && debouncedAmount > 0n,
    shouldUseBatch,
    ...txCallbacks
  });

  const writeHook = batchConvert;

  // Map raw viem/Pendle revert messages to user-friendly copy. Only surfaces
  // prepare-time errors (simulation / quote-verify); write/mining errors —
  // including wallet rejection — are handled by the txStatus → ERROR screen
  // flow, so once we have a usable simulation we suppress this message.
  const prepareErrorMessage = useMemo<string | undefined>(() => {
    if (writeHook.prepared) return undefined;
    const raw = writeHook.error?.message;
    if (!raw) return undefined;
    if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
      return t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon, or wait for the quote to refresh.`;
    }
    if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
      return t`Quote expired. Refreshing — please wait a moment.`;
    }
    return t`Unable to prepare transaction. Please try again or adjust your inputs.`;
  }, [writeHook.error, writeHook.prepared]);

  // Surface prepare/verify errors as a toast (in addition to inline display).
  useEffect(() => {
    if (prepareErrorMessage) {
      onNotification?.({
        title: t`Quote unavailable`,
        description: prepareErrorMessage,
        status: TxStatus.ERROR
      });
    }
  }, [prepareErrorMessage, onNotification]);

  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus, setIsLoading]);

  const reviewOnClick = () => {
    setScreen(PendleScreen.REVIEW);

    try {
      const analyticsFlow = side === PendleConvertSide.BUY ? 'supply' : 'withdraw';
      const analyticsSide = side === PendleConvertSide.BUY ? 'buy' : 'sell';
      // `amount` = USD value of the non-PT leg (input on buy, output on sell).
      // useWidgetAnalytics applies the withdraw sign; pass positive magnitude.
      const leg = pendleNonPtLeg(analyticsSide, {
        originSymbol: originToken.symbol,
        targetSymbol: targetToken.symbol,
        amountInBigint: debouncedAmount,
        amountOutBigint: quote?.amountOut ?? 0n,
        fromDecimals,
        toDecimals
      });
      onAnalyticsEvent?.({
        event: WidgetAnalyticsEventType.REVIEW_VIEWED,
        action: analyticsFlow,
        flow: analyticsFlow,
        amount: valueUsd(leg.symbol, leg.amount),
        data: pendleAnalyticsData({
          market,
          side: side === PendleConvertSide.BUY ? 'buy' : 'sell',
          originToken,
          targetToken,
          amountFromBigint: debouncedAmount,
          amountToBigint: quote?.amountOut ?? 0n,
          fromDecimals,
          toDecimals,
          slippage,
          quote,
          isBatchTx: shouldUseBatch
        })
      });
    } catch {
      // Analytics must never break functionality
    }
  };

  const nextOnClick = () => {
    setScreen(PendleScreen.ACTION);
    setAmount(0n);
    setTxStatus(TxStatus.IDLE);
    writeHook.reset();
  };

  const errorOnClick = () => writeHook.execute();

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : screen === PendleScreen.ACTION
          ? reviewOnClick
          : writeHook.execute;

  const showSecondaryButton = txStatus === TxStatus.ERROR || screen === PendleScreen.REVIEW;

  const onClickBack = () => {
    writeHook.reset();
    setTxStatus(TxStatus.IDLE);
    setScreen(PendleScreen.ACTION);
  };

  useEffect(() => {
    if (txStatus === TxStatus.IDLE) {
      setShowStepIndicator(needsAllowance);
    }
  }, [txStatus, needsAllowance, setShowStepIndicator]);

  const maturityDate = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Drive the WidgetContext-backed action button (label + disabled state) so the
  // widget reuses the same primaryAlt-styled WidgetButton as Savings/Trade/etc.
  useEffect(() => {
    let label: string;
    if (!isConnectedAndEnabled) {
      label = t`Connect Wallet`;
    } else if (txStatus === TxStatus.SUCCESS) {
      label = t`Back to the ${maturityDate} Market`;
    } else if (txStatus === TxStatus.ERROR) {
      label = t`Retry`;
    } else if (screen === PendleScreen.ACTION && amount === 0n) {
      label = t`Enter amount`;
    } else if (screen === PendleScreen.ACTION) {
      label = t`Review`;
    } else if (shouldUseBatch) {
      label = t`Confirm bundled transaction`;
    } else if (needsAllowance) {
      label = t`Confirm 2 transactions`;
    } else if (flow === PendleFlow.BUY) {
      label = t`Confirm supply`;
    } else {
      label = t`Confirm withdrawal`;
    }
    setButtonText(label);
  }, [
    isConnectedAndEnabled,
    txStatus,
    screen,
    flow,
    amount,
    maturityDate,
    shouldUseBatch,
    needsAllowance,
    linguiCtx,
    setButtonText
  ]);

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const convertDisabled =
    txStatus !== TxStatus.SUCCESS &&
    ([TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
      amount === 0n ||
      insufficientFunds ||
      isAmountWaitingForDebounce ||
      !!quoteError ||
      !writeHook.prepared ||
      writeHook.isLoading);

  useEffect(() => {
    setIsDisabled(isConnectedAndEnabled && convertDisabled);
  }, [isConnectedAndEnabled, convertDisabled, setIsDisabled]);

  const headerSlippage = (
    <PendleConfigMenu slippage={slippage} defaultSlippage={defaultSlippage} setSlippage={setSlippage} />
  );

  return (
    <WidgetContainer
      header={
        <div>
          {onBackToPendle && (
            <Button variant="link" onClick={onBackToPendle} className="mb-2 p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  <Trans>Back to Fixed Yield</Trans>
                </Heading>
              </HStack>
            </Button>
          )}
        </div>
      }
      subHeader={
        <div>
          <Heading variant="x-large" className="whitespace-nowrap">
            <Trans>{maturityDate} Market</Trans>
          </Heading>
          <Text className="text-textSecondary" variant="small">
            <Trans>
              Lock in fixed yield by buying PT-{market.underlyingSymbol}. Each PT redeems 1:1 for{' '}
              {market.underlyingSymbol} at maturity.
            </Trans>
          </Text>
        </div>
      }
      rightHeader={
        <HStack gap={2} className="items-center">
          {headerSlippage}
          {rightHeaderComponent}
        </HStack>
      }
      footer={
        <WidgetButtons
          onClickAction={onClickAction}
          onClickBack={showSecondaryButton ? onClickBack : undefined}
          showSecondaryButton={showSecondaryButton}
          enabled={enabled}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <div className="-mt-4 space-y-0">
        <PendlePoweredBy onExternalLinkClicked={onExternalLinkClicked} />
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="pendle-tx-status" className="h-full">
            <PendleTransactionStatus
              market={market}
              originToken={originToken}
              targetToken={targetToken}
              amount={debouncedAmount}
              quote={quote}
              needsAllowance={needsAllowance}
              isBatchTransaction={shouldUseBatch}
              currentCallIndex={writeHook.currentCallIndex}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : screen === PendleScreen.REVIEW ? (
          <CardAnimationWrapper key="pendle-tx-review" className="h-full">
            <PendleTransactionReview
              market={market}
              originToken={originToken}
              targetToken={targetToken}
              amount={debouncedAmount}
              quote={quote}
              needsAllowance={needsAllowance}
              isBatchTransaction={shouldUseBatch}
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="pendle-action" className="h-full">
            <SupplyWithdraw
              market={market}
              ptToken={ptToken}
              supplyTokenList={supplyTokenList}
              withdrawTokenList={withdrawTokenList}
              selectedSupplyToken={selectedSupplyToken}
              onSupplyTokenChange={handleSupplyTokenChange}
              selectedWithdrawOutToken={selectedWithdrawOutToken}
              onWithdrawOutTokenChange={setSelectedWithdrawOutToken}
              flow={flow}
              onFlowChange={setFlow}
              amount={amount}
              onAmountChange={setAmount}
              inputBalance={inputBalance?.value}
              outputBalance={outputBalance?.value}
              ptBalance={ptBalance?.value}
              quote={quote}
              isFetchingQuote={isFetchingQuote}
              slippage={slippage}
              enabled={isConnectedAndEnabled}
              insufficientFunds={insufficientFunds}
              prepareErrorMessage={prepareErrorMessage}
              quoteErrorMessage={quoteErrorMessage}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const PendleWidget = withWidgetProvider(PendleWidgetWrapped, 'PendleWidget');
