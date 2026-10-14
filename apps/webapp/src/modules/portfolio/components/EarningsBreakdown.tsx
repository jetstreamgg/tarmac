import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatGainMagnitude, isGainNegative } from '@/components/ui/GainValue';
import { IconboxStatus } from '@/components/ui/iconbox';
import { Skeleton } from '@/components/ui/skeleton';
import { CellBadge } from '@/components/ui/table-cells';
import { productIconSymbol, productStatusType } from '@/components/product/productVisuals';
import { TrendingUpGradient } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  buildEarningsBreakdown,
  type BreakdownProduct,
  type BreakdownRow
} from '../earnings/earningsBreakdown';
import type { WalletEarnings } from '../earnings/types';

// APP-589 "Total earned / Earned this month" popup (Figma Tooltip 2682:76634):
// the combined figure on top, then one row per product with its own figure;
// held products without an earnings source carry a "Not tracked" badge.
// Typography per the comp: Label 5 header, Body 6 product names, Label 6 row
// values, Label 7 badges.

const LABEL_5 = 'font-circle text-sm leading-4 font-medium tracking-[-0.28px]';
const LABEL_6 = 'font-circle text-xs leading-[14px] font-medium tracking-[-0.24px]';
const BODY_6 = 'font-graphik text-xs leading-[18px] font-normal';

/** Unsigned figure with a leading `-` for real negatives (stUSDS can lose value). */
const formatFigure = (usd: number): string => `${isGainNegative(usd) ? '-' : ''}${formatGainMagnitude(usd)}`;

type EarningsBreakdownProps = {
  earnings: WalletEarnings;
  field: 'total' | 'month';
  /** Names the rows: every visible marketplace product. */
  products: BreakdownProduct[];
  heldRowIds: ReadonlySet<string>;
};

export function EarningsBreakdown({ earnings, field, products, heldRowIds }: EarningsBreakdownProps) {
  const title = field === 'total' ? <Trans>Total accrued</Trans> : <Trans>Accrued this month</Trans>;
  const totalUsd =
    field === 'total' ? earnings.combined.totalEarnedUsd : earnings.combined.earnedThisMonthUsd;
  const rows = buildEarningsBreakdown({ earnings, field, products, heldRowIds });
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
  const { product, usd, isLoading, untracked } = row;
  return (
    <li className="flex items-center justify-between gap-4" data-testid="earnings-breakdown-row">
      <span className="flex min-w-0 items-center gap-1.5">
        <IconboxStatus size="xs" type={productStatusType(product)}>
          <TokenIcon token={{ symbol: productIconSymbol(product) }} width={12} showChainIcon={false} />
        </IconboxStatus>
        <span className={cn(BODY_6, 'text-fgSecondary truncate')}>{product.name}</span>
        {untracked && (
          <CellBadge tone="warning">
            <Trans>Not tracked</Trans>
          </CellBadge>
        )}
      </span>
      {isLoading ? (
        <Skeleton className="h-3.5 w-12 rounded" />
      ) : (
        <span
          className={cn(
            LABEL_6,
            'shrink-0 text-right',
            untracked || usd === undefined ? 'text-fgSecondary' : 'text-fgPrimary'
          )}
        >
          {usd === undefined ? '—' : formatFigure(usd)}
        </span>
      )}
    </li>
  );
}
