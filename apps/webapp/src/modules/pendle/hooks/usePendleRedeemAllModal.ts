import { useCallback } from 'react';
import { t } from '@lingui/core/macro';
import {
  useBatchPendleRedeemAll,
  usePendleUserPtBalances,
  type RedeemPosition
} from '@jetstreamgg/sky-hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';

type Options = {
  /** Render slot for the modal body (e.g. summary of selected positions) */
  transactionContent?: React.ReactNode;
  onSuccess?: () => void;
};

/**
 * Multi-market matured redemption (Path A) via the global TransactionContext
 * modal. Wraps `useBatchPendleRedeemAll` + `launch()`.
 *
 * The caller passes the selected positions; this hook composes the modal
 * launch + balance refetch on success.
 */
export function usePendleRedeemAllModal(positions: RedeemPosition[], opts: Options = {}) {
  const { launch, txCallbacks } = useTransaction();
  const { mutate: mutatePtBalances } = usePendleUserPtBalances();

  const batchRedeem = useBatchPendleRedeemAll({
    positions,
    enabled: positions.length > 0,
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

  const openRedeemAllModal = useCallback(() => {
    if (positions.length === 0) return;
    const title =
      positions.length === 1
        ? t`Redeem PT-${positions[0].market.underlyingSymbol}`
        : t`Redeem ${positions.length} matured positions`;
    launch({
      title,
      transactionContent: opts.transactionContent,
      confirmLabel: t`Confirm`,
      onConfirm: () => batchRedeem.execute(),
      analytics: {
        widgetName: 'fixed',
        flow: 'redeem-all',
        action: 'redeem-all',
        data: {
          markets: positions.map(p => p.market.marketAddress),
          count: positions.length
        }
      }
    });
  }, [launch, batchRedeem, positions, opts.transactionContent]);

  return {
    openRedeemAllModal,
    isPrepared: batchRedeem.prepared,
    error: batchRedeem.error
  };
}
