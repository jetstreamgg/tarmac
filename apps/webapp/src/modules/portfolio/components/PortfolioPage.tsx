import { Trans } from '@lingui/react/macro';
import { Heading, Text } from '@/modules/layout/components/Typography';

// Placeholder destination screen; the real Portfolio page lands with Track C.
export function PortfolioPage() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Heading>
        <Trans>Portfolio</Trans>
      </Heading>
      <Text variant="medium" className="text-textSecondary">
        <Trans>The Portfolio experience is coming soon.</Trans>
      </Text>
    </div>
  );
}
