import { Trans } from '@lingui/react/macro';
import { Heading, Text } from './ui/Typography';

export function Error({ variant = 'large' }: { variant?: 'large' | 'medium' | 'small' }) {
  return (
    <div className="m-6 flex flex-col">
      <Heading className="text-center" variant={variant}>
        <Trans>Something went wrong</Trans>
      </Heading>
      <Text className="text-text mt-4 text-center">
        <Trans>
          Please try the action again or reach out on Discord for assistance if the problem persists.
        </Trans>
      </Text>
    </div>
  );
}
