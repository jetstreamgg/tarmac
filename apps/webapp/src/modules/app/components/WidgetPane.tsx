import { Balances, Upgrade, Trade, RewardsModule, Savings, Stake } from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { COMING_SOON_MAP, mapIntentToQueryParam, QueryParams } from '@/lib/constants';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { RewardsWidgetPane } from '@/modules/rewards/components/RewardsWidgetPane';
import { TradeWidgetPane } from '@/modules/trade/components/TradeWidgetPane';
import { SavingsWidgetPane } from '@/modules/savings/components/SavingsWidgetPane';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import React, { useEffect } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useActionForToken } from '../hooks/useActionForToken';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { defaultConfig } from '@/modules/config/default-config';
import { useChainId } from 'wagmi';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';
import { StakeWidgetPane } from '@/modules/stake/components/StakeWidgetPane';
import { getSupportedChainIds, getMainnetChainName } from '@/data/wagmi/config/config.default';
import { useSearchParams } from 'react-router-dom';
import { useChains } from 'wagmi';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { isIntentAllowed } from '@/lib/utils';

export type WidgetContent = [
  Intent,
  string,
  (props: IconProps) => React.ReactNode,
  React.ReactNode | null,
  boolean,
  { disabled?: boolean }?
][];

type WidgetPaneProps = {
  intent: Intent;
  children?: React.ReactNode;
};

export const WidgetPane = ({ intent, children }: WidgetPaneProps) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const onConnect = useCustomConnectModal();
  const addRecentTransaction = useAddRecentTransaction();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const onNotification = useNotification();
  const { onExternalLinkClicked } = useConfigContext();
  const { hideZeroBalances, setHideZeroBalances, showAllNetworks, setShowAllNetworks } = useBalanceFilters();
  const locale = i18n.locale;

  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  const rightHeaderComponent = <DualSwitcher />;

  const { Locale, Details } = QueryParams;
  const retainedParams = [Locale, Details];
  const [searchParams, setSearchParams] = useSearchParams();

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode,
    shouldReset: searchParams.get(QueryParams.Reset) === 'true'
  };

  const getQueryParams = (url: string) => getRetainedQueryParams(url, retainedParams, searchParams);

  const actionForToken = useActionForToken();

  const mainnetName = getMainnetChainName(chainId);

  const rewardsUrl = getQueryParams(
    `/?network=${mainnetName}&widget=${mapIntentToQueryParam(Intent.REWARDS_INTENT)}`
  );

  const supportedChainIds = getSupportedChainIds(chainId);

  const chains = useChains();

  const savingsUrlMap: Record<number, string> = {};
  for (const chainId of supportedChainIds) {
    savingsUrlMap[chainId] = getQueryParams(
      `/?network=${chains.find(c => c.id === chainId)?.name}&widget=${mapIntentToQueryParam(Intent.SAVINGS_INTENT)}`
    );
  }

  const sealUrl = `/seal-engine${getQueryParams(`/?network=${mainnetName}`)}`;
  const stakeUrl = getQueryParams(
    `/?network=${mainnetName}&widget=${mapIntentToQueryParam(Intent.STAKE_INTENT)}`
  );

  const widgetContent: WidgetContent = [
    [
      Intent.BALANCES_INTENT,
      'Balances',
      Balances,
      withErrorBoundary(
        <BalancesWidgetPane
          {...sharedProps}
          hideModuleBalances={isRestrictedBuild}
          actionForToken={actionForToken}
          rewardsCardUrl={rewardsUrl}
          savingsCardUrlMap={savingsUrlMap}
          sealCardUrl={sealUrl}
          stakeCardUrl={stakeUrl}
          customTokenMap={defaultConfig.balancesTokenList}
          chainIds={getSupportedChainIds(chainId)}
          hideZeroBalances={hideZeroBalances}
          setHideZeroBalances={setHideZeroBalances}
          showAllNetworks={showAllNetworks}
          setShowAllNetworks={setShowAllNetworks}
        />
      )
    ],
    [
      Intent.REWARDS_INTENT,
      'Rewards',
      RewardsModule,
      withErrorBoundary(<RewardsWidgetPane {...sharedProps} />)
    ],
    [Intent.SAVINGS_INTENT, 'Savings', Savings, withErrorBoundary(<SavingsWidgetPane {...sharedProps} />)],
    [Intent.UPGRADE_INTENT, 'Upgrade', Upgrade, withErrorBoundary(<UpgradeWidgetPane {...sharedProps} />)],
    [Intent.TRADE_INTENT, 'Trade', Trade, withErrorBoundary(<TradeWidgetPane {...sharedProps} />)],
    [Intent.STAKE_INTENT, 'Stake', Stake, withErrorBoundary(<StakeWidgetPane {...sharedProps} />)]
  ].map(([intent, label, icon, component]) => {
    const comingSoon = COMING_SOON_MAP[chainId]?.includes(intent as Intent);
    return [
      intent as Intent,
      label as string,
      icon as (props: IconProps) => React.ReactNode,
      comingSoon ? null : (component as React.ReactNode),
      comingSoon,
      comingSoon ? { disabled: true } : undefined
    ];
  });

  // Delete reset param after 500ms
  useEffect(() => {
    if (searchParams.get(QueryParams.Reset)) {
      setTimeout(() => {
        setSearchParams(prev => {
          prev.delete(QueryParams.Reset);
          return prev;
        });
      }, 500);
    }
  }, [searchParams]);

  return (
    <WidgetNavigation
      widgetContent={widgetContent.filter(([widgetIntent]) => isIntentAllowed(widgetIntent, chainId))}
      intent={intent}
    >
      {children}
    </WidgetNavigation>
  );
};
