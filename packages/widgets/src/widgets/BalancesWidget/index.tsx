import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { WidgetContainer } from '@widgets/shared/components/ui/widget/WidgetContainer';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { WidgetContext, WidgetProvider } from '@widgets/context/WidgetContext';
import { WidgetProps, WidgetStateChangeParams } from '@widgets/shared/types/widgetState';
import { useConnection } from 'wagmi';
import { BalancesHeader } from './components/BalancesHeader';
import { BalancesContent } from './components/BalancesContent';
import { getValidatedState } from '@widgets/lib/utils';
import { LoadingButton } from '@widgets/shared/components/ui/LoadingButton';
import { ConnectWalletCopy } from '@widgets/shared/components/ui/ConnectWalletCopy';
import { ErrorBoundary } from '@widgets/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { useContext, useEffect, useMemo, useState } from 'react';
import { TokenForChain } from '@jetstreamgg/sky-hooks';
import { BalancesFlow } from './constants';

export type BalancesWidgetProps = WidgetProps & {
  customTokenMap?: { [chainId: number]: TokenForChain[] };
  chainIds?: number[];
  hideModuleBalances?: boolean;
  actionForToken?: (
    symbol: string,
    balance: string,
    tokenChainId: number
  ) => { label: string; actionUrl: string; image: string } | undefined;
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  stakeCardUrl?: string;
  stusdsCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
  showAllNetworks?: boolean;
  setShowAllNetworks?: (showAllNetworks: boolean) => void;
  hideZeroBalances?: boolean;
  setHideZeroBalances?: (hideZeroBalances: boolean) => void;
};

export const BalancesWidget = ({
  onConnect,
  locale,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  hideModuleBalances = false,
  enabled = true,
  actionForToken,
  onExternalLinkClicked,
  onWidgetStateChange,
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  stakeCardUrl,
  stusdsCardUrl,
  customTokenMap,
  chainIds,
  showAllNetworks,
  hideZeroBalances,
  setShowAllNetworks,
  setHideZeroBalances
}: BalancesWidgetProps) => {
  return (
    <ErrorBoundary componentName="BalancesWidget">
      <WidgetProvider locale={locale}>
        <BalancesWidgetWrapped
          onConnect={onConnect}
          rightHeaderComponent={rightHeaderComponent}
          externalWidgetState={externalWidgetState}
          onStateValidated={onStateValidated}
          hideModuleBalances={hideModuleBalances}
          enabled={enabled}
          actionForToken={actionForToken}
          customTokenMap={customTokenMap}
          chainIds={chainIds}
          rewardsCardUrl={rewardsCardUrl}
          savingsCardUrlMap={savingsCardUrlMap}
          sealCardUrl={sealCardUrl}
          stakeCardUrl={stakeCardUrl}
          stusdsCardUrl={stusdsCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          onWidgetStateChange={onWidgetStateChange}
          showAllNetworks={showAllNetworks}
          hideZeroBalances={hideZeroBalances}
          setShowAllNetworks={setShowAllNetworks}
          setHideZeroBalances={setHideZeroBalances}
        />
      </WidgetProvider>
    </ErrorBoundary>
  );
};

const BalancesWidgetWrapped = ({
  onConnect,
  rightHeaderComponent,
  externalWidgetState,
  onStateValidated,
  hideModuleBalances = false,
  enabled = true,
  actionForToken,
  onExternalLinkClicked,
  onWidgetStateChange,
  customTokenMap,
  chainIds,
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  stakeCardUrl,
  stusdsCardUrl,
  showAllNetworks,
  hideZeroBalances,
  setShowAllNetworks,
  setHideZeroBalances
}: BalancesWidgetProps) => {
  const { isConnected, isConnecting } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const validatedExternalState = getValidatedState(externalWidgetState);
  const { txStatus, widgetState, setWidgetState } = useContext(WidgetContext);
  const initialTabIndex = validatedExternalState?.flow === BalancesFlow.TX_HISTORY ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  const onToggle = (number: 0 | 1) => {
    setTabIndex(number);
    const flow = number === 0 ? BalancesFlow.FUNDS : BalancesFlow.TX_HISTORY;
    setWidgetState({
      ...widgetState,
      flow
    });
    onWidgetStateChange?.({ widgetState: { ...widgetState, flow }, txStatus });
  };

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
        ) : undefined
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!isConnectedAndEnabled ? (
          <CardAnimationWrapper key="widget-not-connected">
            <BalancesHeader
              isConnectedAndEnabled={isConnectedAndEnabled}
              tabIndex={tabIndex}
              onExternalLinkClicked={onExternalLinkClicked}
              onToggle={onToggle}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-connected" className="flex flex-col gap-4">
            <BalancesHeader
              isConnectedAndEnabled={isConnectedAndEnabled}
              tabIndex={tabIndex}
              onExternalLinkClicked={onExternalLinkClicked}
              onToggle={onToggle}
            />
            <BalancesContent
              tabIndex={tabIndex}
              validatedExternalState={validatedExternalState}
              customTokenMap={customTokenMap}
              hideModuleBalances={hideModuleBalances}
              actionForToken={actionForToken}
              rewardsCardUrl={rewardsCardUrl}
              savingsCardUrlMap={savingsCardUrlMap}
              sealCardUrl={sealCardUrl}
              stakeCardUrl={stakeCardUrl}
              stusdsCardUrl={stusdsCardUrl}
              onExternalLinkClicked={onExternalLinkClicked}
              onToggle={onToggle}
              chainIds={chainIds}
              showAllNetworks={showAllNetworks}
              hideZeroBalances={hideZeroBalances}
              setShowAllNetworks={setShowAllNetworks}
              setHideZeroBalances={setHideZeroBalances}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
