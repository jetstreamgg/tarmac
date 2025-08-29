import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { LoadingErrorWrapper } from './LoadingErrorWrapper';
import { Trans } from '@lingui/react/macro';

interface StatsCardProps {
  title: React.ReactElement | string;
  content: React.ReactElement;
  isLoading?: boolean;
  error?: Error | null;
  visible?: boolean;
  className?: string;
}

export function StatsCard({ title, content, isLoading, error, visible = true, className }: StatsCardProps) {
  if (!visible) return null;
  return (
    <BaseStatsCard
      className={className}
      title={title}
      content={
        <LoadingErrorWrapper
          isLoading={!!isLoading}
          loadingClassName="mt-2 h-6 w-10"
          error={error ? error : null}
          errorComponent={
            <Text className="mt-2">
              <Trans>Unable to fetch data</Trans>
            </Text>
          }
        >
          {content}
        </LoadingErrorWrapper>
      }
    />
  );
}

function BaseStatsCard({ title, content, className }: StatsCardProps): React.ReactElement {
  return (
    <Card variant="stats" className={className}>
      <CardTitle>{title}</CardTitle>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
