import { ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex, type EarnRiskTier } from '@/hooks';
import { tabsTriggerVariants } from '@/components/ui/tabs';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import { ConvertArrows, Vaults } from '@/modules/icons';

export type EarnFilterOption = FilterOption;

const RISK_TIERS: { value: EarnRiskTier; label: ReactNode }[] = [
  { value: 'low', label: <Trans>Low</Trans> },
  { value: 'moderate', label: <Trans>Moderate</Trans> },
  { value: 'advanced', label: <Trans>Advanced</Trans> }
];

// Comp 486:22051: full-width 40px pill triggers with Label 6 text; the desktop
// toolbar keeps the compact dropdown-S recipe untouched.
const MOBILE_TRIGGER = 'h-10 w-full justify-between text-xs leading-3.5 tracking-[-0.24px]';

export type EarnTableFiltersProps = {
  /** Selected risk tiers; empty = no risk filtering (all tiers shown). */
  selectedRiskTiers: EarnRiskTier[];
  onRiskTierToggle: (tier: EarnRiskTier) => void;
  networks: EarnFilterOption[];
  selectedNetwork: string;
  onNetworkChange: (value: string) => void;
  stablecoins: EarnFilterOption[];
  selectedStablecoin: string;
  onStablecoinChange: (value: string) => void;
  products: EarnFilterOption[];
  selectedProduct: string;
  onProductChange: (value: string) => void;
};

/**
 * Filter bar of the Earn Opportunities section: risk pills + the three
 * dropdowns. Below md (486:22051) the dropdowns stack full-width under the
 * chips row and grow a leading glyph; from md the single-row toolbar stays as
 * C2 shipped it.
 */
export function EarnTableFilters({
  selectedRiskTiers,
  onRiskTierToggle,
  networks,
  selectedNetwork,
  onNetworkChange,
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
                'text-xs leading-3.5 tracking-[-0.24px] md:text-sm md:leading-4 md:tracking-[-0.28px]'
              )}
            >
              {tier.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <FilterSelect
          options={networks}
          selected={selectedNetwork}
          onChange={onNetworkChange}
          allLabel={
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 md:hidden" />
              <Trans>All networks</Trans>
            </span>
          }
          testId="earn-filter-network"
          triggerClassName={triggerClassName}
        />
        <FilterSelect
          options={stablecoins}
          selected={selectedStablecoin}
          onChange={onStablecoinChange}
          allLabel={
            <span className="flex items-center gap-1.5">
              <ConvertArrows boxSize={12} className="md:hidden" />
              <Trans>All stablecoins</Trans>
            </span>
          }
          testId="earn-filter-stablecoin"
          triggerClassName={triggerClassName}
        />
        <FilterSelect
          options={products}
          selected={selectedProduct}
          onChange={onProductChange}
          allLabel={
            <span className="flex items-center gap-1.5">
              <Vaults boxSize={12} className="md:hidden" />
              <Trans>All products</Trans>
            </span>
          }
          testId="earn-filter-product"
          triggerClassName={triggerClassName}
        />
      </div>
    </div>
  );
}
