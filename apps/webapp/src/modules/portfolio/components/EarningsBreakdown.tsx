import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatGainMagnitude, isGainNegative } from '@/components/ui/GainValue';
import { IconboxStatus } from '@/components/ui/iconbox';
import { Skeleton } from '@/components/ui/skeleton';
import { CellBadge } from '@/components/ui/table-cells';
import { productIconSymbol, productStatusType } from '@/components/product/productVisuals';
import { TrendingUpGradient } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { BreakdownNote, BreakdownRow } from '../earnings/earningsBreakdown';

// APP-589 "Total earned / Earned this month" popup (Figma Tooltip 2682:76634):
// the combined figure on top, then one row per product with its own figure
// and at most one caveat badge. Typography per the comp: Label 5 header,
// Body 6 product names, Label 6 row values, Label 7 badges.

const LABEL_5 = 'font-circle text-sm leading-4 font-medium tracking-[-0.28px]';
const LABEL_6 = 'font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]';
const BODY_6 = 'font-graphik text-xs leading-[18px] font-normal';

const NOTE_BADGE: Record<BreakdownNote, { tone: 'warning' | 'error' | 'neutral'; label: ReactNode }> = {
  'not-tracked': { tone: 'warning', label: <Trans>Not tracked</Trans> },
  unavailable: { tone: 'error', label: <Trans>Unavailable</Trans> },
  partial: { tone: 'error', label: <Trans>Partial data</Trans> },
  'rewards-not-included': { tone: 'neutral', label: <Trans>Rewards not included</Trans> },
  'mainnet-only': { tone: 'neutral', label: <Trans>Mainnet only</Trans> }
};

/** Unsigned figure with a leading `-` for real negatives (stUSDS can lose value). */
const formatFigure = (usd: number): string => `${isGainNegative(usd) ? '-' : ''}${formatGainMagnitude(usd)}`;

export function EarningsBreakdown({
  title,
  totalUsd,
  rows
}: {
  title: ReactNode;
  totalUsd: number;
  rows: BreakdownRow[];
}) {
  return (
    <div className="flex w-full flex-col gap-3" data-testid="earnings-breakdown">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <TrendingUpGradient boxSize={12} className="size-3 shrink-0" aria-hidden />
          <span className={cn(LABEL_5, 'text-fgPrimary')}>{title}</span>
        </span>
        <span className={cn(LABEL_5, 'text-fgPrimary text-right')}>{formatFigure(totalUsd)}</span>
      </div>

      {rows.length > 0 && (
        <>
          <div className="border-borderPrimary border-b" />
          <ul className="flex flex-col gap-2">
            {rows.map(row => (
              <BreakdownRowItem key={row.product.id} row={row} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BreakdownRowItem({ row }: { row: BreakdownRow }) {
  const { product, usd, isLoading, note } = row;
  const badge = note ? NOTE_BADGE[note] : undefined;
  return (
    <li className="flex items-center justify-between gap-4" data-testid="earnings-breakdown-row">
      <span className="flex min-w-0 items-center gap-1.5">
        <IconboxStatus size="xs" type={productStatusType(product)}>
          <TokenIcon token={{ symbol: productIconSymbol(product) }} width={12} showChainIcon={false} />
        </IconboxStatus>
        <span className={cn(BODY_6, 'text-fgSecondary truncate')}>{product.name}</span>
        {badge && <CellBadge tone={badge.tone}>{badge.label}</CellBadge>}
      </span>
      {isLoading ? (
        <Skeleton className="h-3.5 w-12 rounded" />
      ) : (
        <span
          className={cn(
            LABEL_6,
            'shrink-0 text-right',
            note === 'not-tracked' || usd === undefined ? 'text-fgSecondary' : 'text-fgPrimary'
          )}
        >
          {usd === undefined ? '—' : formatFigure(usd)}
        </span>
      )}
    </li>
  );
}
