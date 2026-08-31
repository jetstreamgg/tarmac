import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { cn } from '@/lib/utils';

interface LoadingErrorWrapperProps {
  isLoading: boolean;
  error: Error | null;
  loadingComponent?: React.ReactElement;
  loadingClassName?: string;
  errorComponent?: React.ReactElement;
  errorClassName?: string;
  children?: React.ReactNode;
}

export const LoadingErrorWrapper = ({
  isLoading,
  error,
  children,
  loadingComponent,
  loadingClassName,
  errorComponent,
  errorClassName
}: LoadingErrorWrapperProps) => {
  if (isLoading && !error) {
    return loadingComponent || <Skeleton className={cn('h-5 w-full', loadingClassName)} />;
  }
  if (error) {
    return (
      errorComponent || (
        <Text variant="medium" className={cn('mt-2', errorClassName)}>
          Error: {error.message}
        </Text>
      )
    );
  }

  return children ? <>{children}</> : null;
};
