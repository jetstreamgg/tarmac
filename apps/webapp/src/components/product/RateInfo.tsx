import { cn } from '@/lib/cn';
import { InfoTooltip } from '@/components/InfoTooltip';
import { getTooltipById } from '@/modules/ui/data/tooltips';
import { parseMarkdownLinks } from '@/modules/ui/lib/parseMarkdownLinks';
import { type PopoverTooltipType, resolveTooltipId } from '@/modules/ui/components/PopoverRateInfo';
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
 * The info glyph beside a rate figure: the same centralized copy the widget
 * `PopoverRateInfo` shows, on the design-system Tooltip (Default type, title
 * over body; Design QA 3314:135504) via `InfoTooltip`, so it hovers on
 * desktop and taps on touch like every other info glyph in the app. Glyph
 * defaults to 14px fg-secondary, the size the supply cards already use.
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
  const tooltip = getTooltipById(resolveTooltipId(type));
  if (!tooltip) return null;
  return (
    <InfoTooltip
      title={tooltip.title}
      content={parseMarkdownLinks(tooltip.tooltip)}
      iconSize={size}
      iconClassName={cn('text-fgSecondary shrink-0', className)}
    />
  );
}
