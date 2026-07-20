import { Trans } from '@lingui/react/macro';
import { BP, useBreakpointIndex, type EarnProductRow } from '@/hooks';
import { getChainIcon } from '@/utils';
import { Button } from '@/components/ui/button';
import { HeaderBadge } from '@/components/ui/page-header';
import { IconboxStatus } from '@/components/ui/iconbox';
import { CellNetworks } from '@/components/ui/table-cells';
import { RiskTierMeter } from '@/components/product/RiskMeter';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/** Badges / Set: the bordered 24px pill around the overlapping network icons. */
function NetworksBadge({ networks }: { networks: number[] }) {
  return (
    <span className="border-glassBorder flex h-6 w-fit items-center rounded-full border p-1">
      <CellNetworks>{networks.map(id => getChainIcon(id, 'h-full w-full'))}</CellNetworks>
    </span>
  );
}

/**
 * The highlighted product card of the /earn hero band. Card anatomy per the
 * mobile comp (486:22051); reduced to the single Sky Savings highlight per the
 * later "Earn (Only one highlighted)" iteration (1036:201301) — the comp's
 * second (Pendle) card was dropped by that design decision.
 *
 * Mobile-only for now: the desktop comps carry highlighted cards too, but this
 * ticket's AC pins desktop unchanged — flagged on APP-377.
 */
export function EarnFeaturedCards({
  rows,
  onSelect
}: {
  rows: EarnProductRow[];
  onSelect: (id: string) => void;
}) {
  const { bpi } = useBreakpointIndex();
  const savings = rows.find(row => row.id === 'savings');

  if (bpi >= BP.md || !savings) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="earn-featured-cards">
      <article
        className="bg-bgSecondary flex flex-col rounded-[28px] p-5 backdrop-blur-[20px]"
        data-testid="earn-featured-savings"
      >
        <div className="flex flex-wrap items-center gap-2">
          <HeaderBadge
            size="s"
            icon={
              <TokenIcon token={{ symbol: 'SKY' }} width={16} showChainIcon={false} className="h-4 w-4" />
            }
          >
            <Trans>Powered by Sky</Trans>
          </HeaderBadge>
          <NetworksBadge networks={savings.networks} />
        </div>
        <IconboxStatus size="l" className="mt-6 size-14">
          <TokenIcon
            token={{ symbol: savings.tokenSymbol }}
            width={48}
            showChainIcon={false}
            className="h-11 w-11"
          />
        </IconboxStatus>
        <h3 className="text-fgPrimary font-circle mt-5 text-xl leading-[22px] font-medium tracking-[-0.4px]">
          <Trans>Sky Savings</Trans>
        </h3>
        <p className="text-fgSecondary mt-2 text-xs leading-[18px]">
          <Trans>
            Governed by Sky Ecosystem to deliver the best risk-adjusted yield, sUSDS allows you to grow your
            holdings with instant liquidity and zero fees.
          </Trans>
        </p>
        <div className="mt-8 flex items-center gap-6">
          <div className="flex h-10 flex-col justify-between">
            <span className="text-fgSecondary text-xs leading-[18px]">
              <Trans>APY</Trans>
            </span>
            <span className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
              {savings.rate.formatted}
            </span>
          </div>
          <div className="bg-borderPrimary h-6 w-px shrink-0" />
          <div className="flex h-10 flex-col justify-between">
            <span className="text-fgSecondary text-xs leading-[18px]">
              <Trans>Risk</Trans>
            </span>
            <RiskTierMeter tier={savings.risk} />
          </div>
        </div>
        <Button variant="primary" size="m" className="mt-5 w-full" onClick={() => onSelect(savings.id)}>
          <Trans>Supply</Trans>
        </Button>
      </article>
    </div>
  );
}
