import { cn } from '@widgets/lib/utils';
import { HStack } from '../layout/HStack';
import { LoadingSpinner } from './LoadingSpinner';
import { Text } from '../Typography';

export function FetchingSpinner({
  message,
  className = '',
  spinnerClassName = ''
}: {
  message: string;
  className?: string;
  spinnerClassName?: string;
}): React.ReactElement {
  const classes = cn('items-center p-4', className);

  return (
    <HStack gap={2} className={classes}>
      <LoadingSpinner className={spinnerClassName} />
      <Text variant="medium" className="text-text font-medium">
        {message}
      </Text>
    </HStack>
  );
}
