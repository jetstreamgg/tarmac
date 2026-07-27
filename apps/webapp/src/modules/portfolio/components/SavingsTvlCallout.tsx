import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { SimulateEarningsModal } from './SimulateEarningsModal';

/**
 * Stand-in TVL while `loading` — a b-scale figure so the transparent heading
 * wraps like the real one will ("$8.88b" and "$4.68b" are the same width class).
 */
const SKELETON_TVL_USD = 8_880_000_000;

/** Inline skeleton dress: the copy stays in the layout (so the card is exactly
 * as tall as it will be once loaded, at any width and in any locale) but reads
 * as per-line pills — `box-decoration-clone` gives each wrapped line its own
 * rounded background. */
const LINE_PILLS = 'bg-surface box-decoration-clone rounded text-transparent select-none';

/**
 * Top-of-page onboarding pitch shown when the user has no significant earn
 * position and nothing idle to allocate: how much is already earning the Sky
 * Savings Rate, plus a "Simulate earnings" entry point.
 *
 * With `loading` it renders as its own skeleton — same copy, same geometry —
 * while the callout gate settles, so settling never moves the content below.
 */
export function SavingsTvlCallout({
  tvlUsd,
  savingsRate,
  loading = false
}: {
  tvlUsd: number;
  savingsRate: number;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      className={cn(
        'flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8',
        loading && 'animate-pulse'
      )}
      data-testid={loading ? 'portfolio-callout-skeleton' : 'savings-tvl-callout'}
    >
      <div className="flex flex-col gap-2">
        <Heading tag="h2" className="text-text text-xl font-medium">
          <span className={cn(loading && LINE_PILLS)}>
            <Trans>
              {`$${formatNumber(loading ? SKELETON_TVL_USD : tvlUsd, { compact: true }).toLowerCase()}`} in
              stablecoins already earning the Sky Savings Rate
            </Trans>
          </span>
        </Heading>
        <Text variant="medium" className="text-textSecondary max-w-xl">
          <span className={cn(loading && LINE_PILLS)}>
            <Trans>
              Projections assume current rate held constant. Sky Savings Rate is variable and set by Sky
              Ecosystem governance. Not financial advice.
            </Trans>
          </span>
        </Text>
      </div>

      {loading ? (
        <div className="bg-surface h-12 w-44 shrink-0 rounded-full" />
      ) : (
        <>
          <Button variant="primary" size="l" className="shrink-0" onClick={() => setOpen(true)}>
            <Trans>Simulate earnings</Trans>
          </Button>

          <SimulateEarningsModal open={open} onOpenChange={setOpen} savingsRate={savingsRate} />
        </>
      )}
    </Card>
  );
}
