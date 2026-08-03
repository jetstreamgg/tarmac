import { Trans } from '@lingui/react/macro';
import { InfoTooltip } from '@/components/InfoTooltip';

/**
 * The "Network fee" row label, with the tooltip that owns what the number cannot say.
 *
 * The figure is the going rate on the network — base fee plus the median priority fee
 * actually paid (see `PRIORITY_FEE_PERCENTILE`). The priority half is chosen by the
 * user's wallet, not by us and not by the protocol, and wallets differ by an order of
 * magnitude: on one transaction MetaMask's Market tier quoted $0.59 where Ambire quoted
 * $0.07. So the copy names both components and says the cost can land either side of the
 * estimate rather than only above it.
 *
 * `InfoTooltip` rather than the DS `Tooltip` directly: that one is force-closed on touch
 * devices, which would put this explanation out of reach on the surface — a phone —
 * where the fee is least expected. The hybrid keeps hover on desktop and swaps in a
 * tap-opened popover in the same chrome on touch. Its content carries the 260px cap and
 * the 11px type; don't re-specify them.
 */
export function NetworkFeeLabel() {
  return (
    <span className="flex items-center gap-1.5">
      <Trans>Network fee</Trans>
      <InfoTooltip
        iconSize={14}
        iconClassName="text-textSecondary hover:text-text"
        content={
          <Trans>
            Estimated at the current network rate: the base fee plus a typical priority fee. Your wallet
            chooses the final priority fee, so your cost may be higher or lower.
          </Trans>
        }
      />
    </span>
  );
}
