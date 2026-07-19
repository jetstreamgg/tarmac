import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import {
  formatDecimalPercentage,
  formatUsd,
  getChainIcon,
  getChainName,
  projectAnnualEarnings
} from '@/utils';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconboxStatus } from '@/components/ui/iconbox';
import { GainValue } from '@/components/ui/GainValue';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import type { SuppliedPosition } from '../helpers/suppliedView';
import { ProductGlyph } from './ProductGlyph';

// DS card comp (486:20195 mobile / 486:20044 desktop): the stat value is the
// Label 5 type (14/16, Circular medium) — shared with table cells and pills.
const statValue = 'font-circle text-text text-sm leading-4 font-medium tracking-[-0.28px]';

// Label 6 (12/14) network name, muted — the DS Badges/Illustration label.
const networkName = 'font-circle text-textSecondary text-xs leading-[14px] font-medium tracking-[-0.24px]';

/**
 * One supplied position in the Portfolio carousel: a 64px ringed status iconbox,
 * the network badge, a 2×2 stats block split by per-row dividers, and
 * Supply/Manage actions. Presentational — the caller owns each action
 * (`onSupply` opens the product's supply modal in place, switching networks
 * first when needed; products without a modal route to the product page).
 */
export function PositionCard({
  position,
  onSupply,
  onManage
}: {
  position: SuppliedPosition;
  onSupply: () => void;
  onManage: () => void;
}) {
  const projected = projectAnnualEarnings(position.amountUsd, position.rate);

  return (
    <Card className="flex flex-col gap-7 p-5" data-testid="position-card">
      {/* DS Iconbox/Status: 64px box, borderTertiary ring, 48px token inside. */}
      <div className="flex items-start justify-between">
        <IconboxStatus size="l">
          <TokenIcon
            token={{ symbol: position.tokenSymbol }}
            width={48}
            showChainIcon={false}
            className="h-12 w-12"
          />
        </IconboxStatus>
        <NetworkBadge chainIds={position.chainIds} />
      </div>

      <div className="flex items-center gap-1.5">
        <Text variant="large" tag="span" className="text-text text-2xl font-medium">
          {position.name}
        </Text>
        <ProductGlyph id={position.id} kind={position.kind} />
      </div>

      {/* Two stat rows, each pair split by its own short vertical divider; the
          first column is fixed so the divider aligns across both rows. */}
      <div className="flex flex-col gap-5">
        <div className="flex">
          <Stat
            className="w-[112px]"
            label={<Trans>My position</Trans>}
            value={<span className={statValue}>{formatUsd(position.amountUsd)}</span>}
          />
          <StatDivider />
          <Stat
            className="flex-1"
            label={<Trans>Rate</Trans>}
            value={<span className={statValue}>{formatDecimalPercentage(position.rate ?? 0)}</span>}
          />
        </div>
        <div className="flex">
          {/* TODO(D1): Already earned needs a cost-basis source (no hook yet). */}
          <Stat
            className="w-[112px]"
            label={<Trans>Already earned</Trans>}
            value={<span className={cn(statValue, 'text-textSecondary')}>TODO</span>}
          />
          <StatDivider />
          <Stat
            className="flex-1"
            label={<Trans>1Y projected earnings</Trans>}
            value={
              <GainValue
                value={projected}
                className="font-circle text-sm leading-4 font-medium tracking-[-0.28px]"
              />
            }
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="l"
          className="flex-1"
          onClick={onSupply}
          data-testid="position-card-supply"
        >
          <Trans>Supply</Trans>
        </Button>
        <Button
          variant="secondary"
          size="l"
          className="flex-1"
          onClick={onManage}
          data-testid="position-card-manage"
        >
          <Trans>Manage</Trans>
        </Button>
      </div>
    </Card>
  );
}

/**
 * DS Badges/Illustration: a 16px chain icon + chain name for a single-chain
 * position. Positions holding balances on several chains keep the stacked icons
 * with an "N networks" label (the comp only specifies the single-chain case).
 */
function NetworkBadge({ chainIds }: { chainIds: number[] }) {
  if (chainIds.length === 1) {
    return (
      <span className="flex items-center gap-1" data-testid="position-card-networks">
        <span className="flex h-4 w-4 shrink-0">{getChainIcon(chainIds[0], 'h-full w-full')}</span>
        <span className={networkName}>{getChainName(chainIds[0])}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5" data-testid="position-card-networks">
      <IconStack size={16}>{chainIds.map(id => getChainIcon(id, 'h-full w-full'))}</IconStack>
      {/* Always ≥2 chains here (the single-chain case returns above), so the
          label is always plural — no ICU pluralization needed. */}
      <span className={networkName}>
        <Trans>{chainIds.length} networks</Trans>
      </span>
    </span>
  );
}

function Stat({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {value}
    </div>
  );
}

/** Short vertical divider between the two stats in a row (per-row, not full-height). */
function StatDivider() {
  return <div className="bg-border mx-5 w-px self-stretch" />;
}
