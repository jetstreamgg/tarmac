import { useCallback } from 'react';
import { t } from '@lingui/core/macro';
import {
  isMarketMatured,
  useBatchPendleRedeemMulticall,
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
 * Built on top of `useBatchPendleRedeemMulticall` with a one-element
 * `positions` array. That re-uses the same security-verified multicall path
 * the multi-redeem flow uses — single source of truth for the redeem call
 * shape. (For a single market the inner `multicall(bytes[])` wraps just one
 * exit call, which is technically wasteful but keeps every redeem path going
 * through the same primitive.)
 */
export function usePendleRedeemModal(market: PendleMarketConfig, opts: Options = {}) {
  const { launch, txCallbacks } = useTransaction();
  const { data: ptBalances, mutate: mutatePtBalances } = usePendleUserPtBalances();
  const ptBalance = ptBalances?.[market.marketAddress] ?? 0n;
  const matured = isMarketMatured(market.expiry);
  const isRedeemable = matured && ptBalance > 0n;

  const batchRedeem = useBatchPendleRedeemMulticall({
    positions: isRedeemable ? [{ market, ptBalance }] : [],
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
      onConfirm: () => batchRedeem.execute(),
      analytics: {
        widgetName: 'pendle',
        flow: 'redeem',
        action: 'redeem',
        data: { market: market.marketAddress, underlyingSymbol: market.underlyingSymbol }
      }
    });
  }, [launch, batchRedeem, market.underlyingSymbol, market.marketAddress, opts.transactionContent]);

  return {
    openRedeemModal,
    isRedeemable,
    isPrepared: batchRedeem.prepared,
    ptBalance,
    error: batchRedeem.error
  };
}
