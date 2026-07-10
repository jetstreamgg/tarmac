import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { tabsTriggerVariants } from '@/components/ui/tabs';
import { FilterSelect, type FilterOption } from '@/components/product/FilterSelect';
import type { EarnRiskTier } from '@/hooks';

export type EarnFilterOption = FilterOption;

const RISK_TIERS: { value: EarnRiskTier; label: ReactNode }[] = [
  { value: 'low', label: <Trans>Low</Trans> },
  { value: 'moderate', label: <Trans>Moderate</Trans> },
  { value: 'advanced', label: <Trans>Advanced</Trans> }
];

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

/** Filter bar of the Earn Opportunities section: risk pills + the three dropdowns. */
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="earn-filters">
      <div className="flex items-center gap-2">
        <span className="text-textSecondary text-sm">
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
              className={cn(tabsTriggerVariants({ variant: 'pill' }))}
            >
              {tier.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          options={networks}
          selected={selectedNetwork}
          onChange={onNetworkChange}
          allLabel={<Trans>All networks</Trans>}
          testId="earn-filter-network"
        />
        <FilterSelect
          options={stablecoins}
          selected={selectedStablecoin}
          onChange={onStablecoinChange}
          allLabel={<Trans>All stablecoins</Trans>}
          testId="earn-filter-stablecoin"
        />
        <FilterSelect
          options={products}
          selected={selectedProduct}
          onChange={onProductChange}
          allLabel={<Trans>All products</Trans>}
          testId="earn-filter-product"
        />
      </div>
    </div>
  );
}
