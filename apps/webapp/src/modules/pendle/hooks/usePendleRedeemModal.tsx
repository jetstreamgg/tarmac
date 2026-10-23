import { useCallback, useId, useState } from 'react';
import { mainnet } from 'viem/chains';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import {
  isMarketMatured,
  isPendleChain,
  PendleConvertSide,
  useBatchPendleConvert,
  usePendleUserPtBalances,
  useQuotePendleConvert,
  type PendleMarketConfig,
  type Token
} from '@/hooks';
import { isTestnetId } from '@/utils';
import { Intent } from '@/lib/enums';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { usePendleTokens } from '@/modules/pendle/hooks/usePendleTokens';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { PendleRedeemFlow } from '../components/PendleRedeemFlow';
import { usePendleSlippage } from './usePendleSlippage';

/**
 * A matured-PT card's side of the redeem flow: whether there is anything to
 * redeem, whether its claim would prepare (gating the card's Claim), and the
 * launch, which switches the wallet onto Pendle's chain first when needed. The
 * review itself is `PendleRedeemFlow`, with its own engine in the session.
 */
export function usePendleRedeemModal(market: PendleMarketConfig) {
  const { launch } = useTransaction();
  const sessionId = useId();
  const { data: ptBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const { withdrawTokenList } = usePendleTokens(market);
  const [selectedOutputToken, setSelectedOutputToken] = useState<Token>(withdrawTokenList[0]);
  const outputTokenAddress = selectedOutputToken.address[mainnet.id] as `0x${string}`;
  const { slippage } = usePendleSlippage('redeem');

  // Fetched once for the card's readiness; the open review repolls its own.
  const { data: quote } = useQuotePendleConvert({
    side: PendleConvertSide.WITHDRAW,
    marketAddress: market.marketAddress,
    inputToken: market.ptToken,
    outputToken: outputTokenAddress,
    underlyingToken: market.underlyingToken,
    syAcceptedTokens: market.syAcceptedTokens,
    amountIn: isRedeemable ? ptBalance : undefined,
    slippage,
    enabled: isRedeemable,
    poll: false,
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
    shouldUseBatch
  });

  // Wrong chain: switch on click, then open — the Portfolio supply actions'
  // pattern (usePortfolioSupplyActions). The auto flags make the shell toast
  // explain the change; a rejected switch opens nothing and stays retryable.
  const chainId = useChainId();
  const chains = useChains();
  const onPendleChain = isPendleChain(chainId);
  const { switchChainAsync } = useSwitchChain();
  const { setIsAutoSwitching, setAutoSwitchIntent, canSwitchChain } = useNetworkSwitch();
  const { trackNetworkSwitchRequested, trackNetworkSwitchCompleted } = useAppAnalytics();
  // A wallet the dapp must not switch (a Safe, APP-486) — the cards disable
  // Claim and explain instead of offering a click that always fails.
  const switchBlocked = !onPendleChain && !canSwitchChain;

  const openRedeemModal = useCallback(async () => {
    if (!onPendleChain) {
      if (!canSwitchChain) return;
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
      sessionId,
      // Pendle redemption is mainnet-only — guard the modal off any L2 (APP-528).
      supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
      flow: (
        <PendleRedeemFlow
          market={market}
          initialOutputToken={selectedOutputToken}
          onOutputTokenChange={setSelectedOutputToken}
        />
      )
    });
  }, [
    onPendleChain,
    canSwitchChain,
    chains,
    chainId,
    setAutoSwitchIntent,
    setIsAutoSwitching,
    trackNetworkSwitchRequested,
    trackNetworkSwitchCompleted,
    switchChainAsync,
    launch,
    sessionId,
    market,
    selectedOutputToken
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
