import { TradeWidget, TxStatus, TradeAction, WidgetStateChangeParams, L2TradeWidget } from '@/widgets';
import { defaultConfig } from '../../config/default-config';
import { restrictedTradeTokenList } from '../../config/tokenListConfig';
import { useChainId } from 'wagmi';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteConvertIntent, useRouteIntent } from '@/lib/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getChainSpecificText, isCowSupportedChainId } from '@/utils';
import { ConvertIntent, Intent } from '@/lib/enums';
import { useGeoConfig } from '@/modules/geo-config';

export function TradeWidgetPane(sharedProps: SharedProps) {
  const chainId = useChainId();

  const queryClient = useQueryClient();
  const { setSelectedConvertOption } = useConfigContext();

  const [, setSearchParams] = useAppSearchParams();

  const isCowSupported = isCowSupportedChainId(chainId);

  const { isRegionRestricted } = useGeoConfig();
  const tradeTokenList = isRegionRestricted
    ? restrictedTradeTokenList[chainId as keyof typeof restrictedTradeTokenList]
    : defaultConfig.tradeTokenList[chainId];

  const intent = useRouteIntent();
  const convertIntent = useRouteConvertIntent();
  const navigate = useNavigate();
  const isConvertContext = intent === Intent.CONVERT_INTENT;

  const handleBackToConvert = () => {
    void navigate({ to: '/convert', search: keepSearch });
    setSelectedConvertOption(undefined);
  };

  const onTradeWidgetStateChange = ({
    txStatus,
    widgetState,
    originToken,
    targetToken
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    const isTradeContext = intent === Intent.CONVERT_INTENT && convertIntent === ConvertIntent.TRADE_INTENT;

    if (!isTradeContext) {
      return;
    }

    if (originToken) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.SourceToken, originToken);
          return prev;
        },
        { replace: true }
      );
    } else if (originToken === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.SourceToken);
          return prev;
        },
        { replace: true }
      );
    }

    if (targetToken) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.TargetToken, targetToken);
          return prev;
        },
        { replace: true }
      );
    } else if (targetToken === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.TargetToken);
          return prev;
        },
        { replace: true }
      );
    }

    if (
      widgetState.action === TradeAction.TRADE &&
      (txStatus === TxStatus.LOADING || txStatus === TxStatus.SUCCESS)
    ) {
      setTimeout(() => {
        if (isCowSupported) {
          queryClient.invalidateQueries({ queryKey: ['cowswap-trade-history'] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['psm-trade-history'] });
        }
      }, REFRESH_DELAY);
    }
  };

  const Widget = isCowSupported ? TradeWidget : L2TradeWidget;

  return (
    <Widget
      {...sharedProps}
      disallowedPairs={defaultConfig.tradeDisallowedPairs}
      customTokenList={tradeTokenList}
      onWidgetStateChange={onTradeWidgetStateChange}
      widgetTitle={getChainSpecificText(
        {
          base: 'Base Trade',
          arbitrum: 'Arbitrum Trade',
          optimism: 'Optimism Trade',
          unichain: 'Unichain Trade',
          default: 'Trade'
        },
        chainId
      )}
      onBackToConvert={isConvertContext ? handleBackToConvert : undefined}
    />
  );
}
