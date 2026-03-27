import { CardAnimationWrapper, WidgetContainer } from '@jetstreamgg/sky-widgets';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ConvertIntent } from '@/lib/enums';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useToast } from '@/components/ui/use-toast';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { TradeWidgetPane } from '@/modules/trade/components/TradeWidgetPane';
import { ConvertIntentMapping, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader } from '@/components/ui/card';
import { HStack } from '@/modules/layout/components/HStack';
import { Upgrade, Trade } from '@/modules/icons';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import { isL2ChainId, isMainnetId, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { useGeoConfig } from '@/modules/geo-config';

export function ConvertWidgetPane(sharedProps: SharedProps) {
  const { selectedConvertOption, setSelectedConvertOption } = useConfigContext();
  const [, setSearchParams] = useSearchParams();
  const { info, error } = useToast();
  const chainId = useChainId();
  const chains = useChains();
  const isL2 = isL2ChainId(chainId);
  const isSafeWallet = useIsSafeWallet();
  const supportedChainIds = getSupportedChainIds(chainId);
  const mainnetChainId = supportedChainIds.find(isMainnetId) ?? supportedChainIds[0];
  const mainnetChain = chains.find(chain => chain.id === mainnetChainId);
  const { switchChain, isPending } = useSwitchChain();
  const { isModuleEnabled } = useGeoConfig();
  const isTradeEnabled = isModuleEnabled('trade');
  const shouldShowUpgradeOption = !isL2 || !isSafeWallet;

  // If Trade is disabled by geo-config but selected (e.g. via deeplink), clear it
  useEffect(() => {
    if (!isTradeEnabled && selectedConvertOption === ConvertIntent.TRADE_INTENT) {
      setSelectedConvertOption(undefined);
      setSearchParams(params => {
        params.delete(QueryParams.ConvertModule);
        return params;
      });
    }
  }, [isTradeEnabled, selectedConvertOption, setSelectedConvertOption, setSearchParams]);
  const cardInteractionClass = isPending ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer';

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

    setSearchParams(params => {
      params.set(QueryParams.ConvertModule, ConvertIntentMapping[convertIntent]);
      return params;
    });
    setSelectedConvertOption(convertIntent);
  };

  const renderSelectedWidget = () => {
    switch (selectedConvertOption) {
      case ConvertIntent.UPGRADE_INTENT:
        return <UpgradeWidgetPane {...sharedProps} />;
      case ConvertIntent.TRADE_INTENT:
        return isTradeEnabled ? <TradeWidgetPane {...sharedProps} /> : null;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper key={selectedConvertOption} className="h-full">
        {selectedConvertOption ? (
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
                <Trans>Upgrade legacy tokens or trade for Sky ecosystem tokens</Trans>
              </Text>
            }
            rightHeader={sharedProps.rightHeaderComponent}
          >
            <CardAnimationWrapper className="flex flex-col gap-4">
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

              {isTradeEnabled && (
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
              )}
            </CardAnimationWrapper>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
