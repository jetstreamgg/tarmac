import { useContext, useEffect, useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { useChainId } from 'wagmi';
import { useConnection } from 'wagmi';
import {
  isMarketMatured,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useBatchPendleConvert,
  useIsBatchSupported,
  usePendleRedeem,
  useQuotePendleConvert,
  useTokenAllowance,
  useTokenBalance,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { isTestnetId, getTransactionLink, useDebounce, useIsSafeWallet } from '@jetstreamgg/sky-utils';
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
import { MaturedRedeem } from './components/MaturedRedeem';
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
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
};

const PendleWidgetWrapped = ({
  market,
  onConnect,
  rightHeaderComponent,
  onNotification,
  onExternalLinkClicked,
  onBackToPendle,
  enabled = true,
  batchEnabled,
  setBatchEnabled,
  legalBatchTxUrl
}: PendleWidgetProps) => {
  const chainId = useChainId();
  const { address, isConnected, isConnecting } = useConnection();
  const isConnectedAndEnabled = isConnected && enabled;
  const matured = isMarketMatured(market.expiry);

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

  // Matured market: amount is fixed to the user's full PT balance — there's no
  // input in the UI. Re-sync whenever the balance refetches (and reset to 0 on
  // success since the post-redeem balance becomes 0).
  // Non-matured: caller controls amount via the input.
  const flow = (widgetState.flow as PendleFlow | null) ?? PendleFlow.BUY;
  const screen = (widgetState.screen as PendleScreen | null) ?? PendleScreen.ACTION;
  const isRedeemMode = matured && flow === PendleFlow.WITHDRAW;
  const { slippage, setSlippage, defaultSlippage } = usePendleSlippage(flow);

  // Initialize widgetState (matches the SavingsWidget pattern). Re-runs when
  // the connection state changes — disconnecting mid-flow rolls the user back
  // to the ACTION screen. Matured markets only support WITHDRAW (redeem).
  useEffect(() => {
    setWidgetState({
      flow: matured ? PendleFlow.WITHDRAW : PendleFlow.BUY,
      action: isConnectedAndEnabled ? (matured ? PendleAction.WITHDRAW : PendleAction.BUY) : null,
      screen: PendleScreen.ACTION
    });
  }, [isConnectedAndEnabled, matured, setWidgetState]);

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

  const { data: underlyingBalance, refetch: refetchUnderlyingBalance } = useTokenBalance({
    chainId: balanceChainId,
    address,
    token: market.underlyingToken
  });

  const { data: ptBalance, refetch: refetchPtBalance } = useTokenBalance({
    chainId: balanceChainId,
    address,
    token: market.ptToken
  });

  // Matured: pin the redeem amount to the user's full PT balance. We only do
  // this on ACTION/IDLE so a post-success reset (which clears amount → 0)
  // isn't immediately overwritten before the user dismisses the success card.
  useEffect(() => {
    if (matured && txStatus === TxStatus.IDLE && ptBalance?.value !== undefined) {
      setAmount(ptBalance.value);
    }
  }, [matured, txStatus, ptBalance?.value]);

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
  const needsAllowance = !!(allowance === undefined || allowance < debouncedAmount);
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported && needsAllowance;

  // Matured markets bypass the API quote entirely — redeem is deterministic
  // (PT → SY 1:1, then SY → underlying via SY exchange rate). The convert API
  // is unreliable post-maturity (most market info is dropped) and would route
  // a withdraw through the dead AMM with heavy price impact.
  const { data: quote, isLoading: isFetchingQuote } = useQuotePendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    amountIn: debouncedAmount > 0n ? debouncedAmount : undefined,
    slippage,
    enabled: !matured && isConnectedAndEnabled && debouncedAmount > 0n
  });

  const insufficientFunds = useMemo(() => {
    if (!isConnectedAndEnabled || amount === 0n) return false;
    const balance = flow === PendleFlow.BUY ? underlyingBalance?.value : ptBalance?.value;
    return balance !== undefined && debouncedAmount > balance;
  }, [isConnectedAndEnabled, amount, debouncedAmount, flow, underlyingBalance, ptBalance]);

  // -------- WRITE WIRING --------
  // Two hooks, but only one is live per render (the other is gated by `enabled`):
  //   - matured  → usePendleRedeem (deterministic redeem, no API quote; calls
  //                 Router.exitPostExpToToken directly — no multicall wrapper
  //                 since this widget redeems one market at a time. Pair to
  //                 useBatchPendleRedeemAll for the multi-market case, mirroring
  //                 the stake module's useStakeClaimRewards / useBatchStakeClaimAllRewards split)
  //   - !matured → useBatchPendleConvert (Pendle /convert API → router swap)
  // Both implement the same BatchWriteHook interface so the rest of the widget
  // doesn't care which one's driving.
  const txCallbacks = {
    onMutate: () => {
      setTxStatus(TxStatus.INITIALIZED);
      setExternalLink(undefined);
    },
    onStart: (hash: string | undefined) => {
      setTxStatus(TxStatus.LOADING);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
    },
    onSuccess: (hash: string | undefined) => {
      refetchUnderlyingBalance();
      refetchPtBalance();
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onNotification?.({
        title:
          flow === PendleFlow.BUY
            ? t`Supply complete`
            : matured
              ? t`Redemption complete`
              : t`Withdrawal complete`,
        description:
          flow === PendleFlow.BUY
            ? t`PT-${market.underlyingSymbol} delivered to your wallet.`
            : t`${market.underlyingSymbol} delivered to your wallet.`,
        status: TxStatus.SUCCESS
      });
    },
    onError: (err: Error, hash: string | undefined) => {
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
  };

  const batchConvert = useBatchPendleConvert({
    side,
    marketAddress: market.marketAddress,
    inputToken,
    outputToken,
    amountIn: debouncedAmount > 0n ? debouncedAmount : undefined,
    quote,
    enabled: !matured && isConnectedAndEnabled && debouncedAmount > 0n,
    shouldUseBatch,
    ...txCallbacks
  });

  const redeem = usePendleRedeem({
    market,
    ptBalance: matured && debouncedAmount > 0n ? debouncedAmount : 0n,
    enabled: matured && isConnectedAndEnabled && debouncedAmount > 0n,
    shouldUseBatch,
    ...txCallbacks
  });

  const writeHook = matured ? redeem : batchConvert;

  // Map raw viem/Pendle revert messages to user-friendly copy. Returns
  // undefined when there's no error to show. Keeping this inline (not a
  // separate util) since it's tightly coupled to the messages we surface.
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
        : matured
          ? // Matured redeem skips the Review screen — execute immediately.
            writeHook.execute
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

  // Drive the WidgetContext-backed action button (label + disabled state) so the
  // widget reuses the same primaryAlt-styled WidgetButton as Savings/Trade/etc.
  useEffect(() => {
    let label: string;
    if (!isConnectedAndEnabled) {
      label = t`Connect Wallet`;
    } else if (txStatus === TxStatus.SUCCESS) {
      label = t`Back to ${market.name}`;
    } else if (txStatus === TxStatus.ERROR) {
      label = t`Retry`;
    } else if (matured) {
      // Matured redeem: single-click flow, no separate Review step. Disabled
      // state (e.g. zero PT balance) is set elsewhere via setIsDisabled.
      label = t`Redeem 1:1`;
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
    } else if (isRedeemMode) {
      label = t`Confirm redemption`;
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
    matured,
    isRedeemMode,
    market.name,
    shouldUseBatch,
    needsAllowance,
    linguiCtx,
    setButtonText
  ]);

  const convertDisabled =
    amount === 0n ||
    insufficientFunds ||
    !!prepareErrorMessage ||
    (!writeHook.prepared && !writeHook.isLoading);

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
            {market.name}
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
          {matured ? (
            <Trans>
              This market has matured. Redeem your PT-{market.underlyingSymbol} 1:1 for{' '}
              {market.underlyingSymbol}.
            </Trans>
          ) : (
            <Trans>
              Lock in fixed yield by buying PT-{market.underlyingSymbol}. Each PT redeems 1:1 for{' '}
              {market.underlyingSymbol} at maturity.
            </Trans>
          )}
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
      {screen === PendleScreen.ACTION && txStatus === TxStatus.IDLE && (
        <PendleStatsCard market={market} onExternalLinkClicked={onExternalLinkClicked} />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {txStatus !== TxStatus.IDLE ? (
          <CardAnimationWrapper key="pendle-tx-status" className="h-full">
            <PendleTransactionStatus
              market={market}
              flow={flow}
              amount={debouncedAmount}
              quote={quote}
              isRedeemMode={isRedeemMode}
              targetAmount={matured ? debouncedAmount : undefined}
              needsAllowance={needsAllowance}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : screen === PendleScreen.REVIEW ? (
          <CardAnimationWrapper key="pendle-tx-review" className="h-full">
            <PendleTransactionReview
              market={market}
              flow={flow}
              amount={debouncedAmount}
              quote={quote}
              isRedeemMode={isRedeemMode}
              targetAmount={matured ? debouncedAmount : undefined}
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : matured ? (
          <CardAnimationWrapper key="pendle-matured-redeem" className="h-full">
            <MaturedRedeem
              market={market}
              ptBalance={ptBalance?.value}
              prepareErrorMessage={prepareErrorMessage}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="pendle-action" className="h-full">
            <SupplyWithdraw
              market={market}
              flow={flow}
              onFlowChange={setFlow}
              amount={amount}
              onAmountChange={setAmount}
              underlyingBalance={underlyingBalance?.value}
              ptBalance={ptBalance?.value}
              quote={quote}
              isFetchingQuote={isFetchingQuote}
              slippage={slippage}
              enabled={isConnectedAndEnabled}
              insufficientFunds={insufficientFunds}
              prepareErrorMessage={prepareErrorMessage}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const PendleWidget = withWidgetProvider(PendleWidgetWrapped, 'PendleWidget');
