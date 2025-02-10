import { Heading } from '@/shared/components/ui/Typography';
import { WidgetContainer } from '@/shared/components/ui/widget/WidgetContainer';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { WidgetProvider } from '@/context/WidgetContext';
import { WidgetProps } from '@/shared/types/widgetState';
import { useAccount } from 'wagmi';
import { BalancesHeader } from './components/BalancesHeader';
import { BalancesContent } from './components/BalancesContent';
import { getValidatedState } from '@/lib/utils';
import { LoadingButton } from '@/shared/components/ui/LoadingButton';
import { ConnectWalletCopy } from '@/shared/components/ui/ConnectWalletCopy';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@/shared/animation/Wrappers';
import { useEffect, useMemo } from 'react';
import { TokenForChain } from '@jetstreamgg/hooks';

type BalancesWidgetProps = WidgetProps & {
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
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
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
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  customTokenMap,
  chainIds,
  onExternalLinkClicked
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
          onExternalLinkClicked={onExternalLinkClicked}
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
  customTokenMap,
  chainIds,
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  onExternalLinkClicked
}: BalancesWidgetProps) => {
  const { isConnected, isConnecting } = useAccount();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const validatedExternalState = getValidatedState(externalWidgetState);

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  return (
    <WidgetContainer
      header={
        <Heading variant="x-large">
          <Trans>Balances</Trans>
        </Heading>
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
              initialTabSide={validatedExternalState?.tab}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-connected" className="flex flex-col gap-4">
            <BalancesHeader
              isConnectedAndEnabled={isConnectedAndEnabled}
              initialTabSide={validatedExternalState?.tab}
              onExternalLinkClicked={onExternalLinkClicked}
            />
            <BalancesContent
              validatedExternalState={validatedExternalState}
              customTokenMap={customTokenMap}
              hideModuleBalances={hideModuleBalances}
              actionForToken={actionForToken}
              rewardsCardUrl={rewardsCardUrl}
              savingsCardUrlMap={savingsCardUrlMap}
              sealCardUrl={sealCardUrl}
              onExternalLinkClicked={onExternalLinkClicked}
              chainIds={chainIds}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
