import { PsmConversionWidget, WidgetStateChangeParams } from '@/widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ConvertIntentMapping, QueryParams } from '@/lib/constants';
import { ConvertIntent } from '@/lib/enums';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

export function PsmConversionWidgetPane(sharedProps: SharedProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedConvertOption } = useConfigContext();
  const widgetParam = searchParams.get(QueryParams.Widget)?.toLowerCase();
  const convertModuleParam = searchParams.get(QueryParams.ConvertModule)?.toLowerCase();
  const sourceTokenParam = searchParams.get(QueryParams.SourceToken)?.toUpperCase();
  const isPsmContext =
    widgetParam === 'convert' && convertModuleParam === ConvertIntentMapping[ConvertIntent.PSM_INTENT];

  const handleBackToConvert = () => {
    setSearchParams(params => {
      params.delete(QueryParams.ConvertModule);
      return params;
    });
    setSelectedConvertOption(undefined);
  };

  const onPsmConversionWidgetStateChange = ({ originToken }: WidgetStateChangeParams) => {
    if (!isPsmContext) {
      return;
    }

    const nextSourceToken = originToken || '';
    const currentSourceToken = searchParams.get(QueryParams.SourceToken) || '';

    if (currentSourceToken === nextSourceToken) {
      return;
    }

    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);

        if (nextSourceToken) {
          next.set(QueryParams.SourceToken, nextSourceToken);
        } else {
          next.delete(QueryParams.SourceToken);
        }

        return next;
      },
      { replace: true }
    );
  };

  const externalWidgetState = useMemo(
    () => ({
      token: sourceTokenParam
    }),
    [sourceTokenParam]
  );

  return (
    <PsmConversionWidget
      {...sharedProps}
      onWidgetStateChange={onPsmConversionWidgetStateChange}
      externalWidgetState={externalWidgetState}
      onBackToConvert={handleBackToConvert}
    />
  );
}
