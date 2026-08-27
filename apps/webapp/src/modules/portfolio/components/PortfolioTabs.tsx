import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { tabsListVariants, tabsTriggerVariants } from '@/components/ui/tabs';

/** The two Portfolio views. `idle` is a placeholder pending requirements. */
export type PortfolioTab = 'supplied' | 'idle';

/**
 * Supplied/Idle toggle — design-system Tabs chips (Figma 5029:51762) on plain
 * buttons: single-select, so aria-pressed carries the semantics and data-state
 * drives the recipe's styling contract. Rendered by every Portfolio section
 * (earnings card, positions carousel) but driven by one page-level state, so
 * the toggles stay in sync wherever they appear.
 */
export function PortfolioTabs({
  tab,
  onTabChange,
  className
}: {
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
  className?: string;
}) {
  const tabs: { value: PortfolioTab; label: React.ReactNode }[] = [
    { value: 'supplied', label: <Trans>Supplied</Trans> },
    { value: 'idle', label: <Trans>Idle</Trans> }
  ];
  return (
    <div className={cn(tabsListVariants({ variant: 'pills' }), className)}>
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={tab === value}
          data-state={tab === value ? 'active' : 'inactive'}
          onClick={() => onTabChange(value)}
          className={cn(tabsTriggerVariants({ variant: 'pill' }))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
