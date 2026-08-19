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
 * gating never waits on it. Extracted from the Pendle forms (APP-505); the
 * savings/vault/rewards/stusds/upgrade/convert forms carry the same block and
 * can migrate here.
 */
export function useModalFeeCell(params: UseNetworkFeeParameters): ModalGridFee {
  const { data: fee, isLoading, error } = useNetworkFee(params);
  const state = useBundleFeeState(params.calls.length, fee, !!error);
  return useMemo(
    () => ({ fee, state, loading: isLoading }),
    [
      fee?.formatted,
      fee?.batchSaving,
      isLoading,
      state.ready,
      state.settled,
      state.failed,
      state.canBundle,
      state.promoVisible
    ]
  );
}
