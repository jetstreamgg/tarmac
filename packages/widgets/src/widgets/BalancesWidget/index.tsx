import { Heading } from '@/shared/components/ui/Typography';
import { WidgetContainer } from '@/shared/components/ui/widget/WidgetContainer';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { WidgetContext, WidgetProvider } from '@/context/WidgetContext';
import { WidgetProps, WidgetStateChangeParams } from '@/shared/types/widgetState';
import { useAccount } from 'wagmi';
import { BalancesHeader } from './components/BalancesHeader';
import { BalancesContent } from './components/BalancesContent';
import { getValidatedState } from '@/lib/utils';
import { LoadingButton } from '@/shared/components/ui/LoadingButton';
import { ConnectWalletCopy } from '@/shared/components/ui/ConnectWalletCopy';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AnimatePresence } from 'framer-motion';
import { CardAnimationWrapper } from '@/shared/animation/Wrappers';
import { useContext, useEffect, useMemo, useState } from 'react';
import { TokenForChain } from '@jetstreamgg/hooks';
import { BalancesFlow } from './constants';

export type BalancesWidgetProps = WidgetProps & {
  customTokenList?: TokenForChain[];
  hideModuleBalances?: boolean;
  actionForToken?: (
    symbol: string,
    balance: string
  ) => { label: string; actionUrl: string; image: string } | undefined;
  onClickRewardsCard?: () => void;
  onClickSavingsCard?: () => void;
  onClickSealCard?: () => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onWidgetStateChange?: (params: WidgetStateChangeParams) => void;
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
  onClickRewardsCard,
  onClickSavingsCard,
  onClickSealCard,
  customTokenList,
  onExternalLinkClicked,
  onWidgetStateChange
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
          customTokenList={customTokenList}
          onClickRewardsCard={onClickRewardsCard}
          onClickSavingsCard={onClickSavingsCard}
          onClickSealCard={onClickSealCard}
          onExternalLinkClicked={onExternalLinkClicked}
          onWidgetStateChange={onWidgetStateChange}
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
  customTokenList,
  onClickRewardsCard,
  onClickSavingsCard,
  onClickSealCard,
  onExternalLinkClicked,
  onWidgetStateChange
}: BalancesWidgetProps) => {
  const { isConnected, isConnecting } = useAccount();
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
              customTokenList={customTokenList}
              hideModuleBalances={hideModuleBalances}
              actionForToken={actionForToken}
              onClickRewardsCard={onClickRewardsCard}
              onClickSavingsCard={onClickSavingsCard}
              onClickSealCard={onClickSealCard}
              onExternalLinkClicked={onExternalLinkClicked}
              onToggle={onToggle}
            />
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
