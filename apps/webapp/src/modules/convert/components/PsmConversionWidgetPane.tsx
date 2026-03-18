import {
  PsmConversionWidget,
  TxStatus,
  WidgetStateChangeParams
} from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ConvertIntentMapping, QueryParams } from '@/lib/constants';
import { ConvertIntent } from '@/lib/enums';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';
import { useChainId } from 'wagmi';
import { useChatContext } from '@/modules/chat/context/ChatContext';

export function PsmConversionWidgetPane(sharedProps: SharedProps) {
  const chainId = useChainId();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedConvertOption } = useConfigContext();
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const onAnalyticsEvent = useWidgetAnalytics('convert', chainId);
  const { setShouldDisableActionButtons } = useChatContext();
  const widgetParam = searchParams.get(QueryParams.Widget)?.toLowerCase();
  const convertModuleParam = searchParams.get(QueryParams.ConvertModule)?.toLowerCase();
  const sourceTokenParam = searchParams.get(QueryParams.SourceToken)?.toUpperCase();
  const inputAmountParam = searchParams.get(QueryParams.InputAmount) || undefined;
  const isPsmContext =
    widgetParam === 'convert' && convertModuleParam === ConvertIntentMapping[ConvertIntent.PSM_INTENT];

  const handleBackToConvert = () => {
    setSearchParams(params => {
      params.delete(QueryParams.ConvertModule);
      params.delete(QueryParams.InputAmount);
      return params;
    });
    setSelectedConvertOption(undefined);
  };

  const onPsmConversionWidgetStateChange = ({
    txStatus,
    originToken,
    originAmount
  }: WidgetStateChangeParams) => {
    if (!isPsmContext) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    const nextSourceToken = originToken || '';
    const nextInputAmount = originAmount && originAmount !== '0' ? originAmount : '';
    const currentSourceToken = searchParams.get(QueryParams.SourceToken) || '';
    const currentInputAmount = searchParams.get(QueryParams.InputAmount) || '';

    if (currentSourceToken === nextSourceToken && currentInputAmount === nextInputAmount) {
      return;
    }

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      if (nextSourceToken) {
        next.set(QueryParams.SourceToken, nextSourceToken);
      } else {
        next.delete(QueryParams.SourceToken);
      }

      if (nextInputAmount) {
        next.set(QueryParams.InputAmount, nextInputAmount);
      } else {
        next.delete(QueryParams.InputAmount);
      }

      return next;
    }, { replace: true });
  };

  const externalWidgetState = useMemo(
    () => ({
      amount: inputAmountParam,
      token: sourceTokenParam
    }),
    [inputAmountParam, sourceTokenParam]
  );

  return (
    <PsmConversionWidget
      {...sharedProps}
      onWidgetStateChange={onPsmConversionWidgetStateChange}
      onAnalyticsEvent={onAnalyticsEvent}
      externalWidgetState={externalWidgetState}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      onBackToConvert={handleBackToConvert}
    />
  );
}
