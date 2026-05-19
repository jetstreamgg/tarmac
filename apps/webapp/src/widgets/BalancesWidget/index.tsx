import { Heading, Text } from '@/widgets/shared/components/ui/Typography';
import { WidgetContainer } from '@/widgets/shared/components/ui/widget/WidgetContainer';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { WidgetProvider } from '@/widgets/context/WidgetContext';
import { WidgetProps, WidgetStateChangeParams } from '@/widgets/shared/types/widgetState';
import { useConnection } from 'wagmi';
import { BalancesHeader } from './components/BalancesHeader';
import { BalancesContent } from './components/BalancesContent';
import { LoadingButton } from '@/widgets/shared/components/ui/LoadingButton';
import { ConnectWalletCopy } from '@/widgets/shared/components/ui/ConnectWalletCopy';
import { NoFundsCopy } from '@/widgets/shared/components/ui/NoFundsCopy';
import { ErrorBoundary } from '@/widgets/shared/components/ErrorBoundary';
import { AnimatePresence } from 'motion/react';
import { CardAnimationWrapper } from '@/widgets/shared/animation/Wrappers';
import { useCallback, useMemo, useState } from 'react';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';

export type BalancesWidgetProps = WidgetProps & {
  chainIds?: number[];
  hideRestrictedModules?: boolean;
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  stakeCardUrl?: string;
  stusdsCardUrl?: string;
  vaultsCardUrl?: string;
  fixedYieldCardUrl?: string;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  showAllNetworks?: boolean;
  setShowAllNetworks?: (showAllNetworks: boolean) => void;
  hideZeroBalances?: boolean;
  setHideZeroBalances?: (hideZeroBalances: boolean) => void;
  onExploreVaults?: () => void;
  hideWalletCard?: boolean;
};

export const BalancesWidget = ({
  rightHeaderComponent,
  hideRestrictedModules = false,
  rewardsCardUrl,
  savingsCardUrlMap,
  stakeCardUrl,
  stusdsCardUrl,
  vaultsCardUrl,
  fixedYieldCardUrl,
  chainIds,
  showAllNetworks,
  hideZeroBalances,
  setShowAllNetworks,
  setHideZeroBalances,
  onExploreVaults,
  hideWalletCard
}: BalancesWidgetProps) => {
  const { i18n } = useLingui();
  return (
    <ErrorBoundary componentName="BalancesWidget">
      <WidgetProvider locale={i18n.locale}>
        <BalancesWidgetWrapped
          rightHeaderComponent={rightHeaderComponent}
          hideRestrictedModules={hideRestrictedModules}
          chainIds={chainIds}
          rewardsCardUrl={rewardsCardUrl}
          savingsCardUrlMap={savingsCardUrlMap}
          stakeCardUrl={stakeCardUrl}
          stusdsCardUrl={stusdsCardUrl}
          vaultsCardUrl={vaultsCardUrl}
          fixedYieldCardUrl={fixedYieldCardUrl}
          showAllNetworks={showAllNetworks}
          hideZeroBalances={hideZeroBalances}
          setShowAllNetworks={setShowAllNetworks}
          setHideZeroBalances={setHideZeroBalances}
          onExploreVaults={onExploreVaults}
          hideWalletCard={hideWalletCard}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
};

const BalancesWidgetWrapped = ({
  rightHeaderComponent,
  hideRestrictedModules = false,
  chainIds,
  rewardsCardUrl,
  savingsCardUrlMap,
  stakeCardUrl,
  stusdsCardUrl,
  vaultsCardUrl,
  fixedYieldCardUrl,
  showAllNetworks,
  hideZeroBalances,
  setShowAllNetworks,
  setHideZeroBalances,
  onExploreVaults,
  hideWalletCard
}: BalancesWidgetProps) => {
  const onConnect = useCustomConnectModal();
  const { isConnected, isConnecting } = useConnection();
  const { isConnectedAndAcceptedTerms: enabled } = useConnectedContext();
  const { onExternalLinkClicked } = useConfigContext();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const [allFundsEmpty, setAllFundsEmpty] = useState(false);
  const handleAllFundsEmpty = useCallback((isEmpty: boolean) => setAllFundsEmpty(isEmpty), []);

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Balances</Trans>
        </Heading>
      }
      subHeader={
        <Text className="text-textSecondary" variant="small">
          <Trans>Manage your Sky Ecosystem funds across supported networks</Trans>
        </Text>
      }
      rightHeader={rightHeaderComponent}
      footer={
        !isConnectedAndEnabled ? (
          <div className="flex w-full flex-col items-stretch gap-5">
            {!isConnectedAndEnabled && <ConnectWalletCopy onExternalLinkClicked={onExternalLinkClicked} />}
            <LoadingButton
              onClick={onConnect}
              isLoading={isConnecting}
              buttonText={t`Connect Wallet`}
              variant="primaryAlt"
              className="disabled:text-textMuted font-circle h-full w-full px-6 py-4 text-base"
            />
          </div>
        ) : allFundsEmpty ? (
          <div className="flex w-full flex-col items-stretch gap-5">
            <NoFundsCopy />
            <LoadingButton
              onClick={onExploreVaults}
              buttonText={t`Explore new Vaults and start earning`}
              variant="primaryAlt"
              className="font-circle h-full w-full px-6 py-4 text-base"
            />
          </div>
        ) : undefined
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!isConnectedAndEnabled ? (
          <CardAnimationWrapper key="widget-not-connected">
            <BalancesHeader
              isConnectedAndEnabled={isConnectedAndEnabled}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-connected" className="flex flex-col gap-4">
            {!hideWalletCard && (
              <BalancesHeader
                isConnectedAndEnabled={isConnectedAndEnabled}
                onExternalLinkClicked={onExternalLinkClicked}
              />
            )}
            <BalancesContent
              hideRestrictedModules={hideRestrictedModules}
              rewardsCardUrl={rewardsCardUrl}
              savingsCardUrlMap={savingsCardUrlMap}
              stakeCardUrl={stakeCardUrl}
              stusdsCardUrl={stusdsCardUrl}
              vaultsCardUrl={vaultsCardUrl}
              fixedYieldCardUrl={fixedYieldCardUrl}
              onExternalLinkClicked={onExternalLinkClicked}
              chainIds={chainIds}
              showAllNetworks={showAllNetworks}
              hideZeroBalances={hideZeroBalances}
              setShowAllNetworks={setShowAllNetworks}
              setHideZeroBalances={setHideZeroBalances}
              onAllFundsEmpty={handleAllFundsEmpty}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
