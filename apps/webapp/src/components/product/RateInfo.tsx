import { cn } from '@/lib/cn';
import { PopoverRateInfo, type PopoverTooltipType } from '@/modules/ui/components/PopoverRateInfo';
import type { EarnProductKind } from '@/hooks/earn/types';
import type { ProductIdentity } from './productVisuals';

/**
 * Keys into the centralized rate copy (`modules/ui/data/tooltips`): every rate
 * figure across the app opens the same explainer for its product (APP-540).
 */
export type RateInfoType = PopoverTooltipType;

/** Earn product family → its rate explainer. */
export const RATE_INFO_BY_KIND: Record<EarnProductKind, RateInfoType> = {
  savings: 'ssr',
  stusds: 'stusds',
  fixed: 'fixedYield',
  vault: 'morpho',
  rewards: 'str'
};

/** Rate explainer for a product row (Earn rows, supplied positions). */
export const rateInfoFor = (product: ProductIdentity): RateInfoType => RATE_INFO_BY_KIND[product.kind];

/**
 * The info glyph beside a rate figure. Thin wrapper over the widget
 * `PopoverRateInfo` (tap/click popover, works on touch) pinning the app-side
 * defaults - 14px fg-secondary glyph, the size the supply cards already use.
 */
export function RateInfo({
  type,
  size = 14,
  className
}: {
  type: RateInfoType;
  /** Glyph size in px; the 12px stat labels pass 12. */
  size?: number;
  className?: string;
}) {
  return (
    <PopoverRateInfo
      type={type}
      width={size}
      height={size}
      iconClassName={cn('text-fgSecondary shrink-0', className)}
    />
  );
}
