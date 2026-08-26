import { useMemo } from 'react';
import { useNetworkFee, type UseNetworkFeeParameters } from '@/hooks';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import type { ModalGridFee } from '@/components/product/ModalGridCells';

/**
 * The live Network-fee cell every transaction-modal body wires the same way:
 * `useNetworkFee` → `useBundleFeeState` → a `ModalGridFee` memoized on scalar
 * fields. The scalar deps matter — both source hooks return fresh objects every
 * render, so depending on their identity would give the review breakdown a new
 * identity every render, and the live push that carries it would re-enter the
 * provider on each of its re-renders (the update loop the modal forms guard
 * against).
 *
 * Read-only: the cell shows a skeleton until the estimate resolves; confirm
 * gating never waits on it. Every transaction modal routes through here — the
 * savings, vault, rewards, stUSDS, upgrade, convert, claim and stake bodies.
 */
export function useModalFeeCell(params: UseNetworkFeeParameters): ModalGridFee {
  const { data: fee, isLoading, error } = useNetworkFee(params);
  const state = useBundleFeeState(params.calls.length, fee, !!error);
  return useMemo(
    () => ({ fee, state, loading: isLoading }),
    // Every field the fee row reads, one by one. `promoVisible`/`batchSaving`
    // are absent on purpose: the bundling promo card is gone, so the saving is
    // computed but never rendered — listing it would churn the memo for a value
    // nothing can display.
    [fee?.formatted, isLoading, state.ready, state.settled, state.failed, state.canBundle]
  );
}
