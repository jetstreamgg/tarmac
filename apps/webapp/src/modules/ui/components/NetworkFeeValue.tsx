import { Trans } from '@lingui/react/macro';
import { useIsBatchSupported } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import type { NetworkFeeData } from '@/hooks';
import { BundleTogglePanel } from './BundleTogglePanel';
import { NO_VALUE } from '@/lib/constants';

export type BundleFeeState = {
  /** Every input the row depends on has landed. */
  ready: boolean;
  /** The estimate is in, or has failed — either way it will not change shape again. */
  settled: boolean;
  /** The estimate failed with no figure to show. */
  failed: boolean;
  canBundle: boolean;
};

/**
 * One resolved answer for everything the fee row renders from.
 *
 * The pieces arrive at different times — wallet capabilities from one query, the two gas
 * figures from another, the ETH price from a third — and rendering each as it lands walks
 * the row through several layouts (dash → badge → value → strikethrough). `ready` holds
 * the whole composition until they're all in, so it changes shape once.
 *
 * Toggling bundling afterwards costs nothing: both figures are already simulated and
 * cached, so the row re-reads them without another fetch.
 */
export function useBundleFeeState(
  /**
   * Legs in the flow — what bundling would have to work with. Normally
   * `calls.length`; an engine that collapses its legs into one call when
   * bundling is off (stake's multicall) must pass the bundled count instead,
   * or the toggle vanishes for everyone who has bundling off.
   */
  callCount: number,
  fee?: NetworkFeeData,
  /** The estimate failed — a call that reverts in simulation, an unreachable node. */
  feeFailed = false
): BundleFeeState {
  const { data: batchSupported, isLoading: isSupportLoading } = useIsBatchSupported();

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
    // Failed only counts when there is no figure to fall back on — a held previous
    // estimate keeps rendering through a failed refetch.
    failed: settled && !ready,
    canBundle
  };
}

/**
 * The value side of the "Network fee" row: the bundling badge and the fee.
 *
 * Figma 1036:206870 also strikes the sequential cost through beside a bundled fee. It is
 * deliberately not drawn: it only appears once bundling is *on*, and at that point the
 * saving has already been made — the reader is being sold something they have bought.
 *
 * This badge is the app's only in-modal bundling control (figma-annotations r2, item G2
 * removed the "Save X% on network fees" promo card that used to share the pitch, and the
 * interlock that hid the badge behind it — `BundleSavingsPromo` no longer exists anywhere
 * in the app). The badge shows whenever bundling is available, full stop: on or off, no
 * card to defer to and no snapshot of whether it was on when the modal opened.
 *
 * Without bundling available this is just the fee, so the row is unchanged for wallets
 * that can't batch.
 */
export function NetworkFeeValue({
  fee,
  state,
  loading
}: {
  fee?: NetworkFeeData;
  state: BundleFeeState;
  /** `useNetworkFee().isLoading` — the estimate is wanted and in flight. */
  loading?: boolean;
}) {
  // The dash is reserved for "nothing to estimate".
  const value = state.failed ? (
    <span data-testid="network-fee-failed">
      <Trans>Unavailable</Trans>
    </span>
  ) : loading && !state.ready ? (
    <Skeleton className="h-4 w-10 rounded" data-testid="network-fee-loading" />
  ) : (
    <>{fee?.formatted ?? NO_VALUE}</>
  );

  const showBadge = state.settled && state.canBundle;

  if (!showBadge) return value;

  return (
    <span className="flex items-center gap-2" data-testid="network-fee-value">
      <BundleTogglePanel />
      <span className="text-text font-circle text-sm leading-4 font-medium tracking-[-0.28px]">{value}</span>
    </span>
  );
}
