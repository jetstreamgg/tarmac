import { useEffect, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { SimulateEarningsModal } from './SimulateEarningsModal';
import { trackPromoImpression, trackPromoClicked } from '@/modules/analytics/lib/trackAmbientSurfaces';

/**
 * The headline TVL figure, or an invisible same-width stand-in while it loads
 * (the loading dress lives on the heading span), so the sentence wraps the
 * same before and after the figure lands.
 */
function TvlFigure({ tvlUsd }: { tvlUsd: number | undefined }) {
  return <>{tvlUsd === undefined ? '$0.00b' : `$${formatNumber(tvlUsd, { compact: true }).toLowerCase()}`}</>;
}

/**
 * Top-of-page onboarding pitch shown when the user has no significant earn
 * position and nothing idle to allocate: how much is already earning the Sky
 * Savings Rate, plus a "Simulate earnings" entry point.
 *
 * Everything here is static except the TVL figure, so the card renders in
 * full from first paint — `tvlUsd: undefined` just swaps the number for an
 * inline skeleton chip.
 */
export function SavingsTvlCallout({
  tvlUsd,
  savingsRate
}: {
  /** undefined while the TVL is still loading — renders the number as a chip. */
  tvlUsd: number | undefined;
  /** undefined while the rate query loads — holds the simulate CTA. */
  savingsRate: number | undefined;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    trackPromoImpression({ promoId: 'savings_tvl_simulate' });
  }, []);

  return (
    <Card
      className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8"
      data-testid="savings-tvl-callout"
    >
      <div className="flex flex-col gap-2">
        <Heading tag="h2" className="text-text font-circle text-xl font-medium">
          {/* While the figure loads the whole heading wears the skeleton dress:
              transparent copy over per-line pills (box-decoration-clone gives
              each wrapped line its own), so the height always matches. */}
          <span
            className={cn(
              tvlUsd === undefined &&
                'bg-surface animate-pulse rounded box-decoration-clone text-transparent select-none'
            )}
            data-testid={tvlUsd === undefined ? 'savings-tvl-skeleton' : undefined}
          >
            <Trans>
              <TvlFigure tvlUsd={tvlUsd} /> in stablecoins already accruing the Sky Savings Rate
            </Trans>
          </span>
        </Heading>
        <Text variant="medium" className="text-textSecondary max-w-xl">
          <Trans>
            Projections assume current rate held constant. Sky Savings Rate is variable and set by Sky
            Ecosystem governance. Not financial advice.
          </Trans>
        </Text>
      </div>

      <Button
        variant="primary"
        size="l"
        className="shrink-0"
        disabled={savingsRate === undefined}
        onClick={() => {
          trackPromoClicked({ promoId: 'savings_tvl_simulate' });
          setOpen(true);
        }}
      >
        <Trans>Simulate your savings</Trans>
      </Button>

      <SimulateEarningsModal open={open} onOpenChange={setOpen} savingsRate={savingsRate ?? 0} />
    </Card>
  );
}
