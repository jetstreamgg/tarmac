import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EarnRiskTier } from '@/hooks';

export type EarnFilterOption = { value: string; label: ReactNode };

const RISK_TIERS: { value: EarnRiskTier; label: ReactNode }[] = [
  { value: 'low', label: <Trans>Low</Trans> },
  { value: 'moderate', label: <Trans>Moderate</Trans> },
  { value: 'advanced', label: <Trans>Advanced</Trans> }
];

function FilterSelect({
  options,
  selected,
  onChange,
  allLabel,
  testId
}: {
  options: EarnFilterOption[];
  selected: string;
  onChange: (value: string) => void;
  allLabel: ReactNode;
  testId: string;
}) {
  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger
        data-testid={testId}
        className="border-borderPrimary text-text h-8 w-auto gap-1.5 rounded-full bg-transparent px-3 text-sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
            <button
              key={tier.value}
              type="button"
              aria-pressed={isSelected}
              data-testid={`earn-filter-risk-${tier.value}`}
              onClick={() => onRiskTierToggle(tier.value)}
              className={cn(
                'rounded-full border border-transparent px-3 py-1 text-sm transition-colors',
                isSelected
                  ? 'bg-surface text-text border-borderPrimary'
                  : 'text-textSecondary hover:text-text'
              )}
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
