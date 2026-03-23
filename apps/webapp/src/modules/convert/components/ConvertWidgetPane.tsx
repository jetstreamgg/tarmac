import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ConvertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useToast } from '@/components/ui/use-toast';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { AnimatePresence } from 'framer-motion';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { TradeWidgetPane } from '@/modules/trade/components/TradeWidgetPane';
import { ConvertIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader } from '@/components/ui/card';
import { HStack } from '@/modules/layout/components/HStack';
import { Convert, Upgrade, Trade } from '@/modules/icons';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import { isL2ChainId, isMainnetId, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { PsmConversionWidgetPane } from './PsmConversionWidgetPane';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';

export function ConvertWidgetPane(sharedProps: SharedProps) {
  const { selectedConvertOption, setSelectedConvertOption } = useConfigContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { info, error } = useToast();
  const chainId = useChainId();
  const chains = useChains();
  const isL2 = isL2ChainId(chainId);
  const isSafeWallet = useIsSafeWallet();
  const supportedChainIds = getSupportedChainIds(chainId);
  const mainnetChainId = supportedChainIds.find(isMainnetId) ?? supportedChainIds[0];
  const mainnetChain = chains.find(chain => chain.id === mainnetChainId);
  const { switchChain, isPending } = useSwitchChain();
  const { trackConvertModuleSelected } = useAppAnalytics();
  const shouldShowUpgradeOption = !isL2 || !isSafeWallet;
  const cardInteractionClass = isPending ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer';
  const activeConvertOption = (Object.entries(ConvertIntentMapping).find(
    ([, value]) => value === searchParams.get(QueryParams.ConvertModule)
  )?.[0] ?? selectedConvertOption) as ConvertIntent | undefined;

  const trackModuleSelection = (convertIntent: ConvertIntent) => {
    trackConvertModuleSelected({
      convertModule: ConvertIntentMapping[convertIntent],
      previousConvertModule: activeConvertOption ? ConvertIntentMapping[activeConvertOption] : undefined,
      selectionMethod: 'card',
      entrySurface: 'convert_landing',
      chainId
    });
  };

  const handleSelectOption = (convertIntent: ConvertIntent) => {
    if (isPending) {
      return;
    }

    // If selecting Upgrade on L2, switch to mainnet first and only update state on success
    if (convertIntent === ConvertIntent.UPGRADE_INTENT && isL2) {
      if (!mainnetChain) {
        error(t`Unable to determine the supported mainnet for Upgrade.`);
        return;
      }

      switchChain(
        { chainId: mainnetChain.id },
        {
          onSuccess: () => {
            trackModuleSelection(convertIntent);
            setSearchParams(params => {
              params.set(QueryParams.ConvertModule, ConvertIntentMapping[convertIntent]);
              params.set(QueryParams.Network, normalizeUrlParam(mainnetChain.name));
              return params;
            });
            setSelectedConvertOption(convertIntent);
          },
          onError: err => {
            if (err.name === 'UserRejectedRequestError') {
              info(t`Network switch cancelled. Switch to ${mainnetChain.name} to continue with Upgrade.`);
              return;
            }

            error(
              t`Could not switch networks automatically. Switch to ${mainnetChain.name} in your wallet and try again.`
            );
          }
        }
      );
      return;
    }

    trackModuleSelection(convertIntent);

    setSearchParams(params => {
      params.set(QueryParams.ConvertModule, ConvertIntentMapping[convertIntent]);
      return params;
    });
    setSelectedConvertOption(convertIntent);
  };

  const renderSelectedWidget = () => {
    switch (activeConvertOption) {
      case ConvertIntent.PSM_INTENT:
        return <PsmConversionWidgetPane {...sharedProps} />;
      case ConvertIntent.UPGRADE_INTENT:
        return <UpgradeWidgetPane {...sharedProps} />;
      case ConvertIntent.TRADE_INTENT:
        return <TradeWidgetPane {...sharedProps} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper key={activeConvertOption} className="h-full">
        {activeConvertOption ? (
          renderSelectedWidget()
        ) : (
          <WidgetContainer
            header={
              <Heading variant="x-large">
                <Trans>Convert</Trans>
              </Heading>
            }
            subHeader={
              <Text className="text-textSecondary" variant="small">
                <Trans>Get Sky ecosystem tokens with best possible rates</Trans>
              </Text>
            }
            rightHeader={sharedProps.rightHeaderComponent}
          >
            <CardAnimationWrapper className="flex flex-col gap-4">
              <Card
                role="button"
                tabIndex={isPending ? -1 : 0}
                aria-disabled={isPending}
                className={`from-primary-start/15 to-primary-end/15 hover:from-primary-start/100 hover:to-primary-end/100 bg-radial-(--gradient-position) border-primary-start/30 transition-[background-color,background-image] lg:p-5 ${cardInteractionClass}`}
                onClick={() => handleSelectOption(ConvertIntent.PSM_INTENT)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectOption(ConvertIntent.PSM_INTENT);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center space-y-0">
                  <HStack className="items-center gap-3">
                    <Convert color="inherit" boxSize={28} />
                    <div>
                      <Text>
                        <Trans>1:1 Conversion</Trans>
                      </Text>
                      <Text className="text-textSecondary" variant="small">
                        <Trans>Convert USDC to USDS with 1:1 rate, with no swap fees and no slippage</Trans>
                      </Text>
                    </div>
                  </HStack>
                </CardHeader>
              </Card>

              <Card
                role="button"
                tabIndex={isPending ? -1 : 0}
                aria-disabled={isPending}
                className={`from-card to-card hover:from-primary-start/100 hover:to-primary-end/100 bg-radial-(--gradient-position) transition-[background-color,background-image] lg:p-5 ${cardInteractionClass}`}
                onClick={() => handleSelectOption(ConvertIntent.TRADE_INTENT)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectOption(ConvertIntent.TRADE_INTENT);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center space-y-0">
                  <HStack className="items-center gap-3">
                    <Trade color="inherit" />
                    <div>
                      <Text>
                        <Trans>Trade</Trans>
                      </Text>
                      <Text className="text-textSecondary" variant="small">
                        <Trans>Trade popular tokens for Sky Ecosystem tokens</Trans>
                      </Text>
                    </div>
                  </HStack>
                </CardHeader>
              </Card>

              {shouldShowUpgradeOption && (
                <Card
                  role="button"
                  tabIndex={isPending ? -1 : 0}
                  aria-disabled={isPending}
                  className={`from-card to-card hover:from-primary-start/100 hover:to-primary-end/100 bg-radial-(--gradient-position) transition-[background-color,background-image] lg:p-5 ${cardInteractionClass}`}
                  onClick={() => handleSelectOption(ConvertIntent.UPGRADE_INTENT)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectOption(ConvertIntent.UPGRADE_INTENT);
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center space-y-0">
                    <HStack className="items-center gap-3">
                      <Upgrade color="inherit" />
                      <div>
                        <Text>
                          <Trans>Upgrade</Trans>
                        </Text>
                        <Text className="text-textSecondary" variant="small">
                          <Trans>Upgrade your DAI to USDS and MKR to SKY</Trans>
                        </Text>
                      </div>
                    </HStack>
                  </CardHeader>
                </Card>
              )}
            </CardAnimationWrapper>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
