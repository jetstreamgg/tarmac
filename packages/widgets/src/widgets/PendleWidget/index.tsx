import { useContext, useEffect, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useChainId, useReadContract } from 'wagmi';
import { erc20Abi, zeroAddress } from 'viem';
import { useConnection } from 'wagmi';
import {
  isMarketMatured,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useBatchPendleConvert,
  useQuotePendleConvert,
  useTokenAllowance,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { isTestnetId, getTransactionLink, useIsSafeWallet } from '@jetstreamgg/sky-utils';
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
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { mainnet } from 'viem/chains';
import { PendleAction, PendleFlow, PendleScreen } from './lib/constants';
import { usePendleSlippage } from './hooks/usePendleSlippage';
import { SupplyWithdraw } from './components/SupplyWithdraw';
import { PendleConfigMenu } from './components/PendleConfigMenu';
import { PendlePoweredBy } from './components/PendlePoweredBy';
import { PendleStatsCard } from './components/PendleStatsCard';
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

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    setTxStatus,
    setShowStepIndicator,
    setExternalLink,
    widgetState,
    setWidgetState
  } = useContext(WidgetContext);
  const isSafeWallet = useIsSafeWallet();

  // WidgetProvider initializes isLoading=true; reset on mount so the action
  // button doesn't render a stuck spinner. The real in-flight loading state
  // is set further down based on approve/convert hook isLoading.
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const [amount, setAmount] = useState<bigint>(0n);
  const flow = (widgetState.flow as PendleFlow | null) ?? PendleFlow.BUY;
  const screen = (widgetState.screen as PendleScreen | null) ?? PendleScreen.ACTION;
  const isRedeemMode = matured && flow === PendleFlow.WITHDRAW;
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

  // Allowance for the input token (underlying for Buy, PT for Withdraw) → router.
  // Mirrors the check inside useBatchPendleConvert; React Query cache dedupes.
  const { data: allowance } = useTokenAllowance({
    chainId: balanceChainId,
    contractAddress: inputToken,
    owner: address,
    spender: PENDLE_ROUTER_V4_ADDRESS[balanceChainId]
  });
  const needsAllowance = !!(allowance === undefined || allowance < amount);

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
      setExternalLink(undefined);
    },
    onStart: hash => {
      setTxStatus(TxStatus.LOADING);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
    },
    onSuccess: hash => {
      refetchUnderlyingBalance();
      refetchPtBalance();
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onNotification?.({
        title: flow === PendleFlow.BUY ? t`Supply complete` : t`Withdrawal complete`,
        description:
          flow === PendleFlow.BUY
            ? t`PT-${market.underlyingSymbol} delivered to your wallet.`
            : t`${market.underlyingSymbol} delivered to your wallet.`,
        status: TxStatus.SUCCESS
      });
    },
    onError: (err: Error, hash) => {
      setTxStatus(TxStatus.ERROR);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onNotification?.({
        title: t`Transaction failed`,
        description: err.message,
        status: TxStatus.ERROR
      });
    }
  });

  // Map raw viem/Pendle revert messages to user-friendly copy. Returns
  // undefined when there's no error to show. Keeping this inline (not a
  // separate util) since it's tightly coupled to the messages we surface.
  const prepareErrorMessage = useMemo<string | undefined>(() => {
    const raw = batchConvert.error?.message;
    if (!raw) return undefined;
    if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
      return t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon, or wait for the quote to refresh.`;
    }
    if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
      return t`Quote expired. Refreshing — please wait a moment.`;
    }
    return t`Unable to prepare transaction. Please try again or adjust your inputs.`;
  }, [batchConvert.error]);

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

  const txInFlight = batchConvert.isLoading;
  // True while we're still resolving whether the user can proceed: quote
  // fetch in flight OR simulation hasn't yet returned a verdict (prepared
  // vs error). Drives both the disabled flag and the button spinner so the
  // user can't click into Review before we know it'll work.
  const isCheckingPrepare =
    isConnectedAndEnabled &&
    amount > 0n &&
    !insufficientFunds &&
    !batchConvert.prepared &&
    !prepareErrorMessage;
  const inputSymbolForCopy =
    flow === PendleFlow.BUY ? market.underlyingSymbol : `PT-${market.underlyingSymbol}`;

  // Bridge the in-flight tx state to WidgetContext so WidgetButton renders the
  // proper loading spinner. Also spin during quote/simulation resolution on
  // ACTION so the user sees we're still checking rather than a clickable
  // dead-end.
  useEffect(() => {
    const showSpinner = txInFlight || (screen === PendleScreen.ACTION && isCheckingPrepare);
    setIsLoading(showSpinner);
  }, [txInFlight, screen, isCheckingPrepare, setIsLoading]);

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
    setTxStatus(TxStatus.IDLE);
    batchConvert.reset();
  };

  const onClickBack = () => {
    if (screen === PendleScreen.REVIEW) setScreen(PendleScreen.ACTION);
    else if (screen === PendleScreen.TRANSACTION) {
      setScreen(PendleScreen.ACTION);
      setAmount(0n);
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
      label = t`Connect Wallet`;
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
  }, [isConnectedAndEnabled, screen, flow, isRedeemMode, inputSymbolForCopy, setButtonText]);

  const convertDisabled =
    amount === 0n || insufficientFunds || !!prepareErrorMessage || (!batchConvert.prepared && !txInFlight);

  useEffect(() => {
    setIsDisabled(isConnectedAndEnabled && convertDisabled);
  }, [isConnectedAndEnabled, convertDisabled, setIsDisabled]);

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
        <WidgetButtons
          onClickAction={onClickAction}
          onClickBack={screen === PendleScreen.ACTION ? undefined : onClickBack}
          showSecondaryButton={screen !== PendleScreen.ACTION}
          enabled={enabled}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
    >
      <div className="-mt-4 space-y-0">
        <PendlePoweredBy onExternalLinkClicked={onExternalLinkClicked} />
      </div>
      {screen === PendleScreen.ACTION && (
        <PendleStatsCard market={market} onExternalLinkClicked={onExternalLinkClicked} />
      )}
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
              prepareErrorMessage={prepareErrorMessage}
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
              needsAllowance={needsAllowance}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          )}
        </CardAnimationWrapper>
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const PendleWidget = withWidgetProvider(PendleWidgetWrapped, 'PendleWidget');
