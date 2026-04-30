import { Trans } from '@lingui/react/macro';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';

export const PendleHistoryPlaceholder = () => (
  <Card variant="stats" className="w-full">
    <CardTitle>
      <Trans>Pendle activity</Trans>
    </CardTitle>
    <CardContent>
      <Text variant="medium" className="text-textSecondary mt-2">
        <Trans>
          Pendle transaction history is coming in a follow-up. Once enabled, supplies, redemptions, and
          early withdrawals for this market will appear here.
        </Trans>
      </Text>
    </CardContent>
  </Card>
);
