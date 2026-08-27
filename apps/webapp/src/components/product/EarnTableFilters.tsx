import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex, type EarnRiskTier } from '@/hooks';
import { tabsTriggerVariants } from '@/components/ui/tabs';
import {
  ALL_PRODUCTS_LABEL,
  ALL_STABLECOINS_LABEL,
  FilterSelect,
  type FilterOption
} from '@/components/product/FilterSelect';
import { NetworkFilterSelect } from '@/components/product/NetworkFilterSelect';

export type EarnFilterOption = FilterOption;

const RISK_TIERS: { value: EarnRiskTier; label: ReactNode }[] = [
  { value: 'low', label: <Trans>Core</Trans> },
  { value: 'moderate', label: <Trans>Medium</Trans> },
  { value: 'advanced', label: <Trans>Advanced</Trans> }
];

// Comp 486:22051: full-width 40px pill triggers with Label 6 text; the desktop
// toolbar keeps the compact dropdown-S recipe untouched.
const MOBILE_TRIGGER = 'h-10 w-full justify-between text-xs leading-3.5 tracking-[-0.24px]';

export type EarnTableFiltersProps = {
  /** Selected risk tiers; empty = no risk filtering (all tiers shown). */
  selectedRiskTiers: EarnRiskTier[];
  onRiskTierToggle: (tier: EarnRiskTier) => void;
  stablecoins: EarnFilterOption[];
  selectedStablecoin: string;
  onStablecoinChange: (value: string) => void;
  products: EarnFilterOption[];
  selectedProduct: string;
  onProductChange: (value: string) => void;
};

/**
 * Filter bar of the Earn Opportunities section: risk pills + the three
 * dropdowns, each carrying its leading glyph at every tier (Figma 1036:201239
 * draws them on the desktop toolbar too — they were mobile-only until APP-432
 * item 2). Below md (486:22051) the dropdowns stack full-width under the chips
 * row; from md the single-row toolbar stays as C2 shipped it.
 *
 * The glyph labels live in FilterSelect — the Portfolio transactions toolbar
 * carries the same three. The network one is NetworkFilterSelect: that filter
 * is app-wide, so this toolbar shares both its value and its control with the
 * Portfolio surfaces and the wallet drawer.
 */
export function EarnTableFilters({
  selectedRiskTiers,
  onRiskTierToggle,
  stablecoins,
  selectedStablecoin,
  onStablecoinChange,
  products,
  selectedProduct,
  onProductChange
}: EarnTableFiltersProps) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const triggerClassName = isMobile ? MOBILE_TRIGGER : undefined;

  return (
    <div
      className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3"
      data-testid="earn-filters"
    >
      <div className="flex items-center gap-2">
        <span className="text-textSecondary text-xs md:text-sm">
          <Trans>Risk:</Trans>
        </span>
        {RISK_TIERS.map(tier => {
          const isSelected = selectedRiskTiers.includes(tier.value);
          return (
            // Design-system Tabs chip (Figma 5029:51762) on a plain button:
            // these are multi-select toggles, so aria-pressed carries the
            // semantics and data-state drives the recipe's styling contract.
            <button
              key={tier.value}
              type="button"
              aria-pressed={isSelected}
              data-state={isSelected ? 'active' : 'inactive'}
              data-testid={`earn-filter-risk-${tier.value}`}
              onClick={() => onRiskTierToggle(tier.value)}
              className={cn(
                tabsTriggerVariants({ variant: 'pill' }),
                // The filter comp (1598:77060) switches the active state in
                // ~100ms, faster than the pill recipe's 250ms default.
                'text-xs leading-3.5 tracking-[-0.24px] duration-100 md:text-sm md:leading-4 md:tracking-[-0.28px]'
              )}
            >
              {tier.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <NetworkFilterSelect testId="earn-filter-network" triggerClassName={triggerClassName} />
        <FilterSelect
          options={stablecoins}
          selected={selectedStablecoin}
          onChange={onStablecoinChange}
          allLabel={ALL_STABLECOINS_LABEL}
          testId="earn-filter-stablecoin"
          triggerClassName={triggerClassName}
        />
        <FilterSelect
          options={products}
          selected={selectedProduct}
          onChange={onProductChange}
          allLabel={ALL_PRODUCTS_LABEL}
          testId="earn-filter-product"
          triggerClassName={triggerClassName}
        />
      </div>
    </div>
  );
}
