import { Balances, Upgrade, Trade, RewardsModule, Savings, Seal } from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import {
  CHAIN_WIDGET_MAP,
  COMING_SOON_MAP,
  mapIntentToQueryParam,
  QueryParams,
  restrictedIntents
} from '@/lib/constants';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { RewardsWidgetPane } from '@/modules/rewards/components/RewardsWidgetPane';
import { TradeWidgetPane } from '@/modules/trade/components/TradeWidgetPane';
import { SavingsWidgetPane } from '@/modules/savings/components/SavingsWidgetPane';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { useEffect, useRef, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useActionForToken } from '../hooks/useActionForToken';
import { getRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { defaultConfig } from '@/modules/config/default-config';
import { useChainId } from 'wagmi';
import { SealWidgetPane } from '@/modules/seal/components/SealWidgetPane';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';
import { getSupportedChainIds, getMainnetChainName } from '@/data/wagmi/config/config.default';
import { useSearchParams } from 'react-router-dom';
import { useChains } from 'wagmi';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';

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
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';
  const isRestricted = isRestrictedBuild || isRestrictedMiCa;
  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  const rightHeaderComponent = <DualSwitcher />;

  const { Locale, Details } = QueryParams;
  const retainedParams = [Locale, Details];
  const [searchParams] = useSearchParams();

  const previousChainIdRef = useRef(chainId);
  const [networkHasChanged, setNetworkHasChanged] = useState(false);
  useEffect(() => {
    if (previousChainIdRef.current !== chainId) {
      setNetworkHasChanged(true);
      previousChainIdRef.current = chainId;
    } else {
      // Reset the flag after one render cycle
      setNetworkHasChanged(false);
    }
  }, [chainId]);

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode,
    shouldReset: searchParams.get(QueryParams.Reset) === 'true' || networkHasChanged
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

  const sealUrl = getQueryParams(
    `/?network=${mainnetName}&widget=${mapIntentToQueryParam(Intent.SEAL_INTENT)}`
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
    [Intent.SEAL_INTENT, 'Seal', Seal, withErrorBoundary(<SealWidgetPane {...sharedProps} />)]
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

  return (
    <WidgetNavigation
      widgetContent={widgetContent.filter(([widgetIntent]) => {
        // First check if restricted build
        if (isRestricted && restrictedIntents.includes(widgetIntent)) {
          return false;
        }
        // Then check if widget is supported on current chain
        const supportedIntents = CHAIN_WIDGET_MAP[chainId] || [];
        return supportedIntents.includes(widgetIntent);
      })}
      intent={intent}
    >
      {children}
    </WidgetNavigation>
  );
};
