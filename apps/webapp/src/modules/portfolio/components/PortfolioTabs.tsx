import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

/** The two Portfolio views. `idle` is a placeholder pending requirements. */
export type PortfolioTab = 'supplied' | 'idle';

/**
 * Supplied/Idle pill toggle. Rendered by every Portfolio section (earnings
 * card, positions carousel) but driven by one page-level state, so the toggles
 * stay in sync wherever they appear.
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
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={tab === 'supplied' ? 'pill' : 'chip'}
        size="xs"
        className="h-8 px-4 text-sm"
        aria-pressed={tab === 'supplied'}
        onClick={() => onTabChange('supplied')}
      >
        <Trans>Supplied</Trans>
      </Button>
      <Button
        variant={tab === 'idle' ? 'pill' : 'chip'}
        size="xs"
        className="h-8 px-4 text-sm"
        aria-pressed={tab === 'idle'}
        onClick={() => onTabChange('idle')}
      >
        <Trans>Idle</Trans>
      </Button>
    </div>
  );
}
