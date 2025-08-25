import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { LoadingErrorWrapper } from '@/modules/ui/components/LoadingErrorWrapper';

export function OracleInfo({
  info,
  isLoading,
  error
}: {
  info: string;
  isLoading: boolean;
  error?: Error | null;
}) {
  return (
    <LoadingErrorWrapper
      isLoading={isLoading}
      loadingClassName="h-5"
      error={error ? error : null}
      loadingComponent={<Skeleton className="h-4 w-20" />}
      errorComponent={<></>}
    >
      <Text className="text-textSecondary text-[13px]">{info}</Text>
    </LoadingErrorWrapper>
  );
}
