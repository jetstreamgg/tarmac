import { PsmConversionWidget, WidgetStateChangeParams } from '@/widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { QueryParams } from '@/lib/constants';
import { ConvertIntent } from '@/lib/enums';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteConvertIntent, useRouteIntent } from '@/lib/navigation';
import { Intent } from '@/lib/enums';
import { useMemo } from 'react';

export function PsmConversionWidgetPane(sharedProps: SharedProps) {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const intent = useRouteIntent();
  const convertIntent = useRouteConvertIntent();
  const sourceTokenParam = searchParams.get(QueryParams.SourceToken)?.toUpperCase();
  const isPsmContext = intent === Intent.CONVERT_INTENT && convertIntent === ConvertIntent.PSM_INTENT;

  const handleBackToConvert = () => {
    void navigate({ to: '/convert', search: keepSearch });
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
