import { WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Button } from '@/components/ui/button';
import { QueryParams } from '@/lib/constants';
import { ArrowLeftRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { Card, CardContent } from '@/components/ui/card';

export function PsmConversionWidgetPane(sharedProps: SharedProps) {
  const [, setSearchParams] = useSearchParams();
  const { setSelectedConvertOption } = useConfigContext();

  const handleBackToConvert = () => {
    setSearchParams(params => {
      params.delete(QueryParams.ConvertModule);
      return params;
    });
    setSelectedConvertOption(undefined);
  };

  return (
    <WidgetContainer
      header={
        <div className="flex flex-col items-start gap-3">
          <Button variant="ghost" className="-ml-3 gap-2 px-3" onClick={handleBackToConvert}>
            <ArrowLeftRight className="h-4 w-4 rotate-90" />
            <Trans>Back to Convert</Trans>
          </Button>
          <Heading variant="x-large">
            <Trans>1:1 Conversion</Trans>
          </Heading>
        </div>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Phase 1 wires routing, deeplinks, and details rendering. The transaction widget lands next.</Trans>
        </Text>
      }
      rightHeader={sharedProps.rightHeaderComponent}
    >
      <Card className="from-card to-card bg-radial-(--gradient-position)">
        <CardContent className="space-y-2 p-6">
          <Text>
            <Trans>PSM 1:1 Conversion is now addressable through Convert and deeplinks.</Trans>
          </Text>
          <Text className="text-textSecondary" variant="small">
            <Trans>Input, review, and transaction execution will be added in the next implementation phase.</Trans>
          </Text>
        </CardContent>
      </Card>
    </WidgetContainer>
  );
}
