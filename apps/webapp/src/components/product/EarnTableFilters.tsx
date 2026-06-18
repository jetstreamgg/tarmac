import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
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
            <Button
              key={tier.value}
              variant={isSelected ? 'pill' : 'chip'}
              size="xs"
              aria-pressed={isSelected}
              data-testid={`earn-filter-risk-${tier.value}`}
              onClick={() => onRiskTierToggle(tier.value)}
              className={cn(
                'border-borderPrimary h-8 border px-3 text-sm',
                // secondaryHover === secondary today, so the chip needs its own
                // visible hover; the selected pill keeps its variant hover.
                !isSelected && 'hover:bg-surfaceAlt'
              )}
            >
              {tier.label}
            </Button>
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
