import { useState } from 'react';
import { useIsBatchSupported } from '@/hooks';
import type { NetworkFeeData } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { BundleTogglePanel } from './BundleTogglePanel';

const NO_VALUE = '–';

export type BundleFeeState = {
  /** Every input the row and the card depend on has landed. */
  ready: boolean;
  /** The estimate is in, or has failed — either way it will not change shape again. */
  settled: boolean;
  canBundle: boolean;
  promoVisible: boolean;
};

/**
 * One resolved answer for everything the fee row and the promo card render from.
 *
 * The pieces arrive at different times — wallet capabilities from one query, the two gas
 * figures from another, the ETH price from a third — and rendering each as it lands walks
 * the row through several layouts (dash → badge → value → strikethrough) and pops the card
 * in underneath. `ready` holds the whole composition until they're all in, so it changes
 * shape once.
 *
 * Toggling bundling afterwards costs nothing: both figures are already simulated and
 * cached, so the row re-reads them without another fetch.
 */
export function useBundleFeeState(
  callCount: number,
  fee?: NetworkFeeData,
  /** The estimate failed — a call that reverts in simulation, an unreachable node. */
  feeFailed = false
): BundleFeeState {
  const { data: batchSupported, isLoading: isSupportLoading } = useIsBatchSupported();
  const [batchEnabled] = useBatchToggle();
  // Snapshot: someone who already had bundling on never sees the pitch, and someone who
  // switches it on mid-modal keeps the card until they close and reopen.
  const [enabledOnOpen] = useState(batchEnabled);

  // `formatted` is the one field that requires every input: it exists only once the two
  // gas figures, the fee-per-gas history and the ETH price have all landed. Waiting on
  // `fee` alone let the row render a dash with the data half-there, then update again when
  // the price arrived. Waiting on a formatted figure collapses that into one change.
  //
  // Deliberately not gated on `isFetching`: with the previous result held, a refetch keeps
  // showing the last complete figure rather than blanking the row on every keystroke.
  const ready = !isSupportLoading && fee?.formatted !== undefined;
  const canBundle = !!batchSupported && callCount > 1;

  // The badge is also the only bundling switch inside the modal — the old `BatchToggle`
  // is gone — so it can't hang on the estimate *succeeding*: a call that reverts in
  // simulation would take the control away with it (and the estimate never resolves on a
  // Tenderly fork at all). It still waits for the estimate to settle one way or the
  // other, so the row changes shape once rather than growing a badge mid-fetch.
  const settled = ready || (!isSupportLoading && feeFailed);

  return {
    ready,
    settled,
    canBundle,
    promoVisible: ready && canBundle && !enabledOnOpen && (fee?.batchSaving ?? 0) > 0
  };
}

/**
 * The value side of the "Network fee" row: the bundling badge, the fee, and — when the
 * calls will go out bundled — the sequential cost struck through beside it
 * (Figma 1036:206870).
 *
 * Without bundling available this is just the fee, so the row is unchanged for wallets
 * that can't batch.
 */
export function NetworkFeeValue({ fee, state }: { fee?: NetworkFeeData; state: BundleFeeState }) {
  const [batchEnabled] = useBatchToggle();

  // The `Not bundled` badge exists to explain a higher fee to someone who just switched
  // bundling off. While the promo card is up it is already making that case, so the row
  // stays plain until bundling is actually on (Figma 1036:206739 vs 1036:207086).
  const showBadge = state.settled && state.canBundle && (batchEnabled || !state.promoVisible);

  if (!showBadge) return <>{fee?.formatted ?? NO_VALUE}</>;

  return (
    <span className="flex items-center gap-2" data-testid="network-fee-value">
      <BundleTogglePanel />
      <span className="flex items-baseline gap-2">
        <span className="text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
          {fee?.formatted ?? NO_VALUE}
        </span>
        {fee?.isBatch && fee.sequentialFormatted && (
          <s className="text-textSecondary text-sm" data-testid="network-fee-sequential">
            {fee.sequentialFormatted}
          </s>
        )}
      </span>
    </span>
  );
}
