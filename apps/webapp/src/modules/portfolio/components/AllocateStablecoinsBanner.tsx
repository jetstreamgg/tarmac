import { Trans } from '@lingui/react/macro';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';

/**
 * Top-of-page nudge shown when the user holds idle stablecoins but has no
 * significant earn position: how much those idle funds could earn at the Sky
 * Savings Rate, with a CTA into the Sky Savings product.
 */
export function AllocateStablecoinsBanner({
  idleUsd,
  savingsRate,
  onAllocate
}: {
  idleUsd: number;
  savingsRate: number;
  onAllocate: () => void;
}) {
  const yearly = projectAnnualEarnings(idleUsd, savingsRate);

  return (
    <Card
      className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8"
      data-testid="allocate-stablecoins-banner"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-text font-circle text-3xl leading-none font-medium">{`$${formatNumber(yearly)}`}</span>
          <Text variant="medium" tag="span" className="text-textSecondary">
            <Trans>/year</Trans>
          </Text>
        </div>
        <Text variant="medium" className="text-textSecondary max-w-xl">
          <Trans>
            That&apos;s what your idle stablecoins can earn at today&apos;s{' '}
            <span className="text-text font-medium">
              {formatDecimalPercentage(savingsRate)} Sky Savings Rate
            </span>
            .
          </Trans>
        </Text>
      </div>

      <Button variant="primary" size="l" className="shrink-0" onClick={onAllocate}>
        <Trans>Allocate your stablecoins</Trans>
      </Button>
    </Card>
  );
}
