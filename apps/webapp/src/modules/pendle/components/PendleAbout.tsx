import { Trans } from '@lingui/react/macro';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';

export const PendleAbout = () => (
  <Card variant="stats" className="w-full">
    <CardTitle>
      <Trans>About Pendle fixed yield</Trans>
    </CardTitle>
    <CardContent>
      <Text variant="medium" className="text-textSecondary mt-2">
        <Trans>
          A Principal Token (PT) lets you lock in a fixed yield until a market&apos;s maturity date. You
          buy PT below face value, and at maturity each PT redeems 1:1 for the underlying asset — the
          difference is your fixed yield. Sell early at the prevailing market price if you change your
          mind, or hold until maturity for the full advertised APY.
        </Trans>
      </Text>
    </CardContent>
  </Card>
);
