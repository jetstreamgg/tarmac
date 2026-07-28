import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';

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
 * `TooltipContent` already carries the 260px cap and the 11px type; don't re-specify them.
 */
export function NetworkFeeLabel() {
  return (
    <span className="flex items-center gap-1.5">
      <Trans>Network fee</Trans>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t`About the network fee`}
            data-testid="network-fee-tooltip-trigger"
            className="text-textSecondary hover:text-text flex items-center"
          >
            <Info width={14} height={14} />
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent>
            <Trans>
              Estimated at the current network rate: the base fee plus a typical priority fee. Your wallet
              chooses the final priority fee, so your cost may be higher or lower.
            </Trans>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </span>
  );
}
