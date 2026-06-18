import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { SimulateEarningsModal } from './SimulateEarningsModal';

/**
 * Top-of-page onboarding pitch shown when the user has no significant earn
 * position and nothing idle to allocate: how much is already earning the Sky
 * Savings Rate, plus a "Simulate earnings" entry point.
 */
export function SavingsTvlCallout({ tvlUsd, savingsRate }: { tvlUsd: number; savingsRate: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bg-container flex flex-col gap-4 rounded-3xl border p-6 bg-blend-overlay backdrop-blur-[50px] md:flex-row md:items-center md:justify-between md:p-8"
      data-testid="savings-tvl-callout"
    >
      <div className="flex flex-col gap-2">
        <Heading tag="h2" className="text-text text-xl font-medium">
          <Trans>
            {`$${formatNumber(tvlUsd, { compact: true }).toLowerCase()}`} in stablecoins already earning the
            Sky Savings Rate
          </Trans>
        </Heading>
        <Text variant="medium" className="text-textSecondary max-w-xl">
          <Trans>
            Projections assume current rate held constant. Sky Savings Rate is variable and set by Sky
            Ecosystem governance. Not financial advice.
          </Trans>
        </Text>
      </div>

      <Button variant="primary" className="shrink-0" onClick={() => setOpen(true)}>
        <Trans>Simulate earnings</Trans>
      </Button>

      <SimulateEarningsModal open={open} onOpenChange={setOpen} savingsRate={savingsRate} />
    </div>
  );
}
