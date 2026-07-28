import { useState } from 'react';
import { useIsBatchSupported } from '@/hooks';
import type { NetworkFeeData } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { BundleTogglePanel } from './BundleTogglePanel';

const NO_VALUE = '–';

/** Bundling is on the table only for a multi-call flow on a wallet that supports it. */
export function useCanBundle(callCount: number): boolean {
  const { data: batchSupported } = useIsBatchSupported();
  return !!batchSupported && callCount > 1;
}

/**
 * Whether to show the "Save X%" promo card.
 *
 * Keyed to the toggle's value *when the modal opened*, not its live value: someone who
 * already had bundling on never sees the pitch, and someone who switches it on mid-modal
 * keeps the card until they close and reopen (Figma 1036:207086). The snapshot is what
 * makes both of those true at once.
 */
export function useBundlePromoVisible(canBundle: boolean, saving: number | undefined): boolean {
  const [batchEnabled] = useBatchToggle();
  const [enabledOnOpen] = useState(batchEnabled);
  return canBundle && !enabledOnOpen && saving !== undefined && saving > 0;
}

/**
 * The value side of the "Network fee" row: the bundling badge, the fee, and — when the
 * calls will go out bundled — the sequential cost struck through beside it
 * (Figma 1036:206870).
 *
 * Without bundling available this is just the fee, so the row is unchanged for wallets
 * that can't batch.
 */
export function NetworkFeeValue({ fee, callCount }: { fee?: NetworkFeeData; callCount: number }) {
  const canBundle = useCanBundle(callCount);

  if (!canBundle) return <>{fee?.formatted ?? NO_VALUE}</>;

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
