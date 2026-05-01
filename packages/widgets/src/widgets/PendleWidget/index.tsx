import { useContext, useEffect, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useChainId, useReadContract } from 'wagmi';
import { erc20Abi, zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import {
  isMarketMatured,
  PendleConvertSide,
  useBatchPendleConvert,
  useQuotePendleConvert,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@widgets/components/ui/button';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { AnimatePresence } from 'motion/react';
import { TxStatus } from '@widgets/shared/constants';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { mainnet } from 'viem/chains';
import { PendleFlow, PendleScreen } from './lib/constants';
import { usePendleWidgetState } from './hooks/usePendleWidgetState';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { PendleConfigMenu } from './components/PendleConfigMenu';
import { PendlePoweredBy } from './components/PendlePoweredBy';
import { PendleTransactionReview } from './components/PendleTransactionReview';
import { PendleTransactionStatus } from './components/PendleTransactionStatus';

export type PendleWidgetProps = WidgetProps & {
  /** Selected Pendle market — passed in by the webapp module after URL-driven selection. */
  market: PendleMarketConfig;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  /** When provided, renders a "Back to Pendle" link above the heading. The webapp module
   * uses this to clear the market query params and return to the overview list. */
  onBackToPendle?: () => void;
};

const PendleWidgetWrapped = ({
  market,
  onConnect,
  rightHeaderComponent,
  onNotification,
  onExternalLinkClicked,
  onBackToPendle,
  enabled = true
}: PendleWidgetProps) => {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const isConnectedAndEnabled = isConnected && enabled;
  const matured = isMarketMatured(market.expiry);

  const { setButtonText, setIsDisabled, setIsLoading, setTxStatus, setShowStepIndicator } =
    useContext(WidgetContext);
  // Snapshot the active "phase" for the status screen so we can label the
  // approve vs convert step correctly even after the hook's isLoading flips.
  const [activePhase, setActivePhase] = useState<'idle' | 'approving' | 'converting'>('idle');

  // WidgetProvider initializes isLoading=true; reset on mount so the action
  // button doesn't render a stuck spinner. The real in-flight loading state
  // is set further down based on approve/convert hook isLoading.
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const {
    flow,
    setFlow,
    screen,
    setScreen,
    amount,
    setAmount,
    slippage,
    setSlippage,
    defaultSlippage,
    isRedeemMode
  } = usePendleWidgetState(market);

  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { data: underlyingBalance, refetch: refetchUnderlyingBalance } = useReadContract({
    abi: erc20Abi,
    address: market.underlyingToken,
    functionName: 'balanceOf',
    args: [address ?? zeroAddress],
    chainId: balanceChainId,
    query: { enabled: !!address }
  });

  const { data: ptBalance, refetch: refetchPtBalance } = useReadContract({
    abi: erc20Abi,
    address: market.ptToken,
    functionName: 'balanceOf',
    args: [address ?? zeroAddress],
    chainId: balanceChainId,
    query: { enabled: !!address }
  });

  const inputToken = flow === PendleFlow.BUY ? market.underlyingToken : market.ptToken;
  const outputToken = flow === PendleFlow.BUY ? market.ptToken : market.underlyingToken;
  const side = flow === PendleFlow.BUY ? PendleConvertSide.BUY : PendleConvertSide.WITHDRAW;

  const { data: quote, isLoading: isFetchingQuote } = useQuotePendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    amountIn: amount > 0n ? amount : undefined,
    slippage,
    enabled: isConnectedAndEnabled && amount > 0n
  });

  // TODO(APP-175): drop this console.log before shipping. Useful during scaffold
  // for inspecting Pendle's /convert response shape and decimal handling.
  useEffect(() => {
    if (quote) {
      // eslint-disable-next-line no-console
      console.log('[Pendle quote]', {
        side,
        market: market.name,
        underlyingDecimals: market.underlyingDecimals,
        amountIn: amount.toString(),
        amountOut: quote.amountOut.toString(),
        apiMinOut: quote.apiMinOut.toString(),
        impliedApy: quote.impliedApy,
        effectiveApy: quote.effectiveApy,
        priceImpact: quote.priceImpact,
        method: quote.method
      });
    }
  }, [quote, side, market, amount]);

  const insufficientFunds = useMemo(() => {
    if (!isConnectedAndEnabled || amount === 0n) return false;
    const balance = flow === PendleFlow.BUY ? underlyingBalance : ptBalance;
    return balance !== undefined && amount > balance;
  }, [isConnectedAndEnabled, amount, flow, underlyingBalance, ptBalance]);

  // -------- WRITE WIRING --------
  // useBatchPendleConvert internally handles allowance check + ERC20 approval +
  // Pendle Router convert call. Returns currentCallIndex so we can label which
  // step is active for the status screen.
  const batchConvert = useBatchPendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    amountIn: amount > 0n ? amount : undefined,
    slippage,
    quote,
    enabled: isConnectedAndEnabled && amount > 0n,
    shouldUseBatch: true,
    onMutate: () => {
      setTxStatus(TxStatus.INITIALIZED);
    },
    onStart: () => {
      setTxStatus(TxStatus.LOADING);
    },
    onSuccess: () => {
      refetchUnderlyingBalance();
      refetchPtBalance();
      setTxStatus(TxStatus.SUCCESS);
      onNotification?.({
        title: flow === PendleFlow.BUY ? t`Supply complete` : t`Withdrawal complete`,
        description:
          flow === PendleFlow.BUY
            ? t`PT-${market.underlyingSymbol} delivered to your wallet.`
            : t`${market.underlyingSymbol} delivered to your wallet.`,
        status: TxStatus.SUCCESS
      });
    },
    onError: (err: Error) => {
      setTxStatus(TxStatus.ERROR);
      onNotification?.({
        title: t`Transaction failed`,
        description: err.message,
        status: TxStatus.ERROR
      });
    }
  });

  // Surface prepare/verify errors (e.g. stale quote) as a toast.
  useEffect(() => {
    if (batchConvert.error) {
      onNotification?.({
        title: t`Quote unavailable`,
        description: batchConvert.error.message,
        status: TxStatus.ERROR
      });
    }
  }, [batchConvert.error, onNotification]);

  const txInFlight = batchConvert.isLoading;
  // currentCallIndex 0 = approve when 2 calls; 1 = convert. When only 1 call
  // (no approval needed), currentCallIndex stays 0 and isApproving is false.
  // We flip activePhase based on the hook's reported step.
  useEffect(() => {
    if (!txInFlight) return;
    if (batchConvert.currentCallIndex === 0) {
      setActivePhase('approving');
    } else {
      setActivePhase('converting');
    }
  }, [batchConvert.currentCallIndex, txInFlight]);

  const inputSymbolForCopy =
    flow === PendleFlow.BUY ? market.underlyingSymbol : `PT-${market.underlyingSymbol}`;

  // Bridge the in-flight tx state to WidgetContext so WidgetButton renders the
  // proper loading spinner.
  useEffect(() => {
    setIsLoading(txInFlight);
  }, [txInFlight, setIsLoading]);

  const onClickAction = () => {
    if (!isConnectedAndEnabled) {
      onConnect?.();
      return;
    }
    if (screen === PendleScreen.ACTION) {
      setScreen(PendleScreen.REVIEW);
      return;
    }
    if (screen === PendleScreen.REVIEW) {
      setScreen(PendleScreen.TRANSACTION);
      batchConvert.execute();
      return;
    }
    // TRANSACTION → reset back to ACTION + clear amount
    setScreen(PendleScreen.ACTION);
    setAmount(0n);
    setActivePhase('idle');
    setTxStatus(TxStatus.IDLE);
    batchConvert.reset();
  };

  const onClickBack = () => {
    if (screen === PendleScreen.REVIEW) setScreen(PendleScreen.ACTION);
    else if (screen === PendleScreen.TRANSACTION) {
      setScreen(PendleScreen.ACTION);
      setAmount(0n);
      setActivePhase('idle');
      setTxStatus(TxStatus.IDLE);
      batchConvert.reset();
    }
  };

  // Show the step indicator when the batched flow contains 2 calls
  // (approve + convert). The hook exposes the current call index but not the
  // total step count directly, so we infer "needs allowance" from whether the
  // batched call list will include an approval — for the simplest first pass
  // we just always show it on Buy and hide on Withdraw, mirroring Morpho.
  useEffect(() => {
    setShowStepIndicator(flow === PendleFlow.BUY);
  }, [flow, setShowStepIndicator]);

  // Drive the WidgetContext-backed action button (label + disabled state) so the
  // widget reuses the same primaryAlt-styled WidgetButton as Savings/Trade/etc.
  useEffect(() => {
    let label: string;
    if (!isConnectedAndEnabled) {
      label = t`Connect wallet`;
    } else if (screen === PendleScreen.ACTION) {
      label =
        flow === PendleFlow.BUY
          ? t`Review supply`
          : isRedeemMode
            ? t`Review redemption`
            : t`Review withdrawal`;
    } else if (screen === PendleScreen.REVIEW) {
      label =
        flow === PendleFlow.BUY
          ? t`Confirm supply`
          : isRedeemMode
            ? t`Confirm redemption`
            : t`Confirm withdrawal`;
    } else {
      label = t`Done`;
    }
    setButtonText(label);
  }, [
    isConnectedAndEnabled,
    screen,
    flow,
    isRedeemMode,
    inputSymbolForCopy,
    setButtonText
  ]);

  useEffect(() => {
    let disabled = false;
    if (screen === PendleScreen.ACTION) {
      disabled = !isConnectedAndEnabled || amount === 0n || insufficientFunds;
    } else if (screen === PendleScreen.REVIEW) {
      disabled = txInFlight ? false : !batchConvert.prepared;
    }
    setIsDisabled(disabled);
  }, [
    screen,
    isConnectedAndEnabled,
    amount,
    insufficientFunds,
    batchConvert.prepared,
    txInFlight,
    setIsDisabled
  ]);

  const headerSlippage = (
    <PendleConfigMenu
      slippage={slippage}
      defaultSlippage={defaultSlippage}
      setSlippage={setSlippage}
      flow={flow}
      hidden={isRedeemMode}
    />
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
                  <Trans>Back to Pendle</Trans>
                </Heading>
              </HStack>
            </Button>
          )}
          <Heading variant="x-large" className="whitespace-nowrap">
            PT-{market.underlyingSymbol}
            {matured ? (
              <span className="text-textSecondary ml-2 text-sm font-normal">
                <Trans>· matured</Trans>
              </span>
            ) : null}
          </Heading>
        </div>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>
            Lock in fixed yield by buying PT-{market.underlyingSymbol}. Each PT redeems 1:1 for{' '}
            {market.underlyingSymbol} at maturity.
          </Trans>
        </Text>
      }
      rightHeader={
        <HStack gap={2} className="items-center">
          {headerSlippage}
          {rightHeaderComponent}
        </HStack>
      }
      footer={
        <div className="w-full px-3 pb-3 md:px-6 md:pb-4">
          <WidgetButtons
            onClickAction={onClickAction}
            onClickBack={screen === PendleScreen.ACTION ? undefined : onClickBack}
            showSecondaryButton={screen !== PendleScreen.ACTION}
            enabled={enabled}
            onExternalLinkClicked={onExternalLinkClicked}
          />
        </div>
      }
    >
      <div className="mt-[-16px] space-y-0">
        <PendlePoweredBy onExternalLinkClicked={onExternalLinkClicked} />
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <CardAnimationWrapper key={screen} className="h-full">
          {screen === PendleScreen.ACTION && (
            <SupplyWithdraw
              market={market}
              flow={flow}
              onFlowChange={setFlow}
              amount={amount}
              onAmountChange={setAmount}
              underlyingBalance={underlyingBalance}
              ptBalance={ptBalance}
              quote={quote}
              isFetchingQuote={isFetchingQuote}
              slippage={slippage}
              enabled={isConnectedAndEnabled}
              insufficientFunds={insufficientFunds}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          )}
          {screen === PendleScreen.REVIEW && (
            <PendleTransactionReview
              market={market}
              flow={flow}
              amount={amount}
              quote={quote}
              isRedeemMode={isRedeemMode}
            />
          )}
          {screen === PendleScreen.TRANSACTION && (
            <PendleTransactionStatus
              market={market}
              flow={flow}
              amount={amount}
              quote={quote}
              isRedeemMode={isRedeemMode}
              isApproving={activePhase === 'approving'}
              needsAllowance={activePhase === 'approving'}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          )}
        </CardAnimationWrapper>
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const PendleWidget = withWidgetProvider(PendleWidgetWrapped, 'PendleWidget');
