import { Trans } from '@lingui/react/macro';
import { Heading, Text } from '@/modules/layout/components/Typography';

// Placeholder destination screen; the real Earn marketplace lands with Track C.
export function EarnPage() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Heading>
        <Trans>Earn</Trans>
      </Heading>
      <Text variant="medium" className="text-textSecondary">
        <Trans>The Earn experience is coming soon.</Trans>
      </Text>
    </div>
  );
}
