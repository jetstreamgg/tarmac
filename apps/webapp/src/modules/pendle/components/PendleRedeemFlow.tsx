import { useMemo, useState } from 'react';
import { t } from '@lingui/core/macro';
import { mainnet } from 'viem/chains';
import { useChainId, useConnection } from 'wagmi';
import {
  getTokenDecimals,
  isMarketMatured,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide,
  useBatchPendleConvert,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  useTokenAllowance,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { familyMainnetId, formatBigInt } from '@/utils';
import { useSession, useSettleOnEnd } from '@/modules/ui/context/TransactionContext';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { pendleAnalyticsData } from '@/modules/pendle/lib/pendleAnalyticsData';
import { pendleNonPtLeg } from '@/modules/pendle/lib/pendleUsdValue';
import { usePendleTokens } from '@/modules/pendle/hooks/usePendleTokens';
import { usePendleUsdValue } from '@/modules/pendle/hooks/usePendleUsdValue';
import { PendleRedeem } from './PendleRedeem';
import { pendlePrepareErrorMessage } from '../utils/prepareErrorMessage';
import { usePendleSlippageCell } from '../hooks/usePendleSlippageCell';

/**
 * The matured-PT redeem flow ("Claim matured position"). Routes through the same
 * /convert pipeline as buy/sell so the user can pick the underlying, USDS, or USDC
 * as the output, on the review itself.
 */
export function PendleRedeemFlow({
  market,
  initialOutputToken,
  onOutputTokenChange
}: {
  market: PendleMarketConfig;
  /** The output the card last had selected. */
  initialOutputToken: Token;
  /** Keeps the card's selection (and its readiness check) in step with the review's. */
  onOutputTokenChange: (token: Token) => void;
}) {
  const { txCallbacks } = useSession();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const isRedeemable = isMarketMatured(market.expiry) && ptBalance > 0n;

  const { ptToken, withdrawTokenList } = usePendleTokens(market);
  const [selectedOutputToken, setSelectedOutputToken] = useState<Token>(initialOutputToken);
  const outputTokenAddress = selectedOutputToken.address[mainnet.id] as `0x${string}`;
  const selectOutputToken = (token: Token) => {
    setSelectedOutputToken(token);
    onOutputTokenChange(token);
  };

  const { slippage, slippageDisplay, slippageMode, slippageAction } = usePendleSlippageCell('redeem');
  // Values the redeemed output leg in USD for the analytics `amount` property.
  const valueUsd = usePendleUsdValue();

  // Quote: PT → the selected output via /convert. `maturedExit` adds the
  // YT-with-zero-amount entry the API requires for matured exits.
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
    poll: true,
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
    onSuccess: (hash, blockNumber) => {
      mutatePtBalances();
      txCallbacks.onSuccess(hash, blockNumber);
    },
    onError: (err, hash) => txCallbacks.onError(err, hash)
  });

  // Raw revert messages mapped to the copy the buy/sell modal shows. Only while
  // unprepared, so a recovered simulation drops the stale message.
  const prepareErrorMessage = !writeHook.prepared
    ? pendlePrepareErrorMessage(writeHook.error?.message)
    : undefined;

  // The Network cell describes where the trade executes — the engine chain,
  // which the connected chain only matches while Pendle stays mainnet-gated.
  const chainId = useChainId();
  const engineChainId = familyMainnetId(chainId);
  const networkName = useNetworkName(engineChainId);

  // Steps mirror the engine's call count ([approve?, claim]) — a first-time
  // redeemer signs a PT approval first.
  const { address } = useConnection();
  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId: engineChainId,
    contractAddress: market.ptToken,
    owner: address,
    spender: PENDLE_ROUTER_V4_ADDRESS[engineChainId]
  });
  const ptSymbol = `PT-${market.underlyingSymbol}`;
  const needsAllowance = allowance !== undefined && ptBalance > 0n && allowance < ptBalance;
  const claimStep: TransactionStep = {
    label: t`Claim`,
    tokenSymbol: ptSymbol,
    failureDetail: stepFailureDetail.claim(ptSymbol)
  };
  const steps: TransactionStep[] = needsAllowance
    ? [
        { label: t`Approve`, tokenSymbol: ptSymbol, failureDetail: stepFailureDetail.approve(ptSymbol) },
        claimStep
      ]
    : [claimStep];

  // An approve that mined before the claim failed must not reappear on the next
  // launch: the allowance read is 30s-stale, so refresh it once the run has cleared (APP-563 #3).
  useSettleOnEnd(writeHook.reset, mutateAllowance);

  // Simulated on the engine chain: the calldata is mainnet's even when the wallet sits elsewhere.
  const feeCell = useModalFeeCell({
    calls: writeHook.calls ?? [],
    chainId: engineChainId,
    shouldUseBatch: !!writeHook.isBatch,
    enabled: isRedeemable && !!quote
  });

  const confirmDisabled = !writeHook.prepared || isFetchingQuote || writeHook.isLoading;

  const toDecimals = getTokenDecimals(selectedOutputToken, mainnet.id);
  const leg = pendleNonPtLeg('redeem', {
    originSymbol: ptToken.symbol,
    targetSymbol: selectedOutputToken.symbol,
    amountInBigint: ptBalance,
    amountOutBigint: quote?.amountOut ?? 0n,
    fromDecimals: market.underlyingDecimals,
    toDecimals
  });
  const legUsd = valueUsd(leg.symbol, leg.amount);
  // USD notional (APP-517) of the valued output leg. A non-empty redeem whose leg
  // can't be valued yet (quote or price missing) is unknown: above-threshold.
  const usdValue = leg.amount === 0 ? (ptBalance > 0n ? undefined : 0) : legUsd;

  // `amount` = USD value of the redeemed output leg, negative so dashboard tiles
  // filtering `properties.amount < 0` count redeem as a withdrawal alongside SELL;
  // omitted when no price is available rather than emit a wrong-unit number
  // (APP-444 B14). amountFrom/amountTo in `data` keep the raw counts.
  const analytics = useMemo(
    () => ({
      widgetName: 'fixed',
      flow: 'redeem',
      action: 'redeem',
      data: {
        ...pendleAnalyticsData({
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
        }),
        ...(legUsd !== undefined ? { amount: -Math.abs(legUsd) } : {})
      }
    }),
    [market, ptToken, selectedOutputToken, ptBalance, quote, toDecimals, slippage, legUsd]
  );

  // Success names the quoted receive leg ("Claimed 1,012.30 USDS"). The app never
  // reads the fill off the receipt, so this is the quote the signed tx was built from.
  const received = quote ? formatBigInt(quote.amountOut, { unit: toDecimals, maxDecimals: 2 }) : undefined;

  return (
    <TransactionModal
      title={t`Claim matured position`}
      transactionTitle={t`Confirm in the wallet`}
      toast={{
        loading: t`Claiming your matured position`,
        success: received ? t`Claimed ${received} ${selectedOutputToken.symbol}` : t`Position claimed`,
        error: t`Claim failed`
      }}
      transactionContent={
        <PendleRedeem
          market={market}
          ptBalance={ptBalance}
          outputTokenList={withdrawTokenList}
          selectedOutputToken={selectedOutputToken}
          onOutputTokenChange={selectOutputToken}
          quote={quote}
          isFetchingQuote={isFetchingQuote}
          slippageDisplay={slippageDisplay}
          slippageMode={slippageMode}
          slippageAction={slippageAction}
          network={networkName}
          networkChainId={engineChainId}
          feeCell={feeCell}
        />
      }
      errorMessage={prepareErrorMessage}
      steps={steps}
      confirmLabel={t`Claim`}
      confirmDisabled={confirmDisabled}
      usdValue={usdValue}
      analytics={analytics}
      onConfirm={writeHook.execute}
      dispatch={{ nextCalls: writeHook.nextCalls ?? writeHook.calls ?? [], disabled: confirmDisabled }}
    />
  );
}
