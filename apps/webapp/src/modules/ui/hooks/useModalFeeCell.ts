import { useMemo } from 'react';
import { useNetworkFee, type UseNetworkFeeParameters } from '@/hooks';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import type { ModalGridFee } from '@/components/product/ModalGridCells';

export type UseModalFeeCellParameters = UseNetworkFeeParameters & {
  /**
   * How many legs the flow sends when bundled, where that differs from
   * `calls.length`. `calls` is what goes out on the CURRENT route, and one
   * engine — stake's `useBatchStakeMulticall` — collapses its legs into a
   * single `multicall` when bundling is off, so the unbundled route reports a
   * length of 1 for a flow that bundling would still split into several. Left
   * to infer from `calls.length` there, the bundle toggle disappears for
   * exactly the users who have bundling switched off. Defaults to
   * `calls.length`, which is right for every engine that doesn't reshape.
   */
  legCount?: number;
};

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
export function useModalFeeCell({ legCount, ...params }: UseModalFeeCellParameters): ModalGridFee {
  const { data: fee, isLoading, error } = useNetworkFee(params);
  const state = useBundleFeeState(legCount ?? params.calls.length, fee, !!error);
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
