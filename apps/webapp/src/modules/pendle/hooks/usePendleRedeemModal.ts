import { useCallback } from 'react';
import { t } from '@lingui/core/macro';
import {
  isMarketMatured,
  usePendleRedeem,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

type Options = {
  /** Render slot for the modal body (token tile or similar) */
  transactionContent?: React.ReactNode;
  /** Called after redeem confirms onchain — for refetching balances etc. */
  onSuccess?: () => void;
};

/**
 * Single-market matured redemption via the global TransactionContext modal.
 *
 * Wraps `usePendleRedeem` (direct `Router.exitPostExpToToken` call, no
 * multicall wrapper) + `launch()`. For multi-market redeem use
 * `usePendleRedeemAllModal` instead — that one composes
 * `useBatchPendleRedeemAll`.
 */
export function usePendleRedeemModal(market: PendleMarketConfig, opts: Options = {}) {
  const { launch, txCallbacks } = useTransaction();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const redeem = usePendleRedeem({
    market,
    ptBalance: isRedeemable ? ptBalance : 0n,
    enabled: isRedeemable,
    shouldUseBatch: true,
    onMutate: () => txCallbacks.onMutate(),
    onStart: hash => txCallbacks.onStart(hash),
    onSuccess: hash => {
      mutatePtBalances();
      opts.onSuccess?.();
      txCallbacks.onSuccess(hash);
    },
    onError: (err, hash) => txCallbacks.onError(err, hash)
  });

  const openRedeemModal = useCallback(() => {
    launch({
      title: t`Redeem PT-${market.underlyingSymbol}`,
      transactionContent: opts.transactionContent,
      confirmLabel: t`Confirm`,
      onConfirm: () => redeem.execute(),
      analytics: {
        widgetName: 'pendle',
        flow: 'redeem',
        action: 'redeem',
        data: { market: market.marketAddress, underlyingSymbol: market.underlyingSymbol }
      }
    });
  }, [launch, redeem, market.underlyingSymbol, market.marketAddress, opts.transactionContent]);

  return {
    openRedeemModal,
    isRedeemable,
    isPrepared: redeem.prepared,
    ptBalance,
    error: redeem.error
  };
}
