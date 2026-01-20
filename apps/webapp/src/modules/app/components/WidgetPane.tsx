import { Balances, Upgrade, Trade, RewardsModule, Savings, Stake, Expert } from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { BATCH_TX_LEGAL_NOTICE_URL, COMING_SOON_MAP, QueryParams } from '@/lib/constants';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import React, { Suspense, useEffect } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useActionForToken } from '../hooks/useActionForToken';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { defaultConfig } from '@/modules/config/default-config';
import { useChainId } from 'wagmi';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';
import { StakeWidgetPane } from '@/modules/stake/components/StakeWidgetPane';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useSearchParams } from 'react-router-dom';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { SharedProps, WidgetContent, WidgetItem } from '../types/Widgets';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useModuleUrls } from '../hooks/useModuleUrls';
import { useModuleAvailability } from '@/modules/app/context/ModuleAvailabilityContext';
import { BLOCKED_MODULE_BEHAVIOR } from '@/lib/restricted-modules';
import { ChunkErrorBoundary } from '@/modules/layout/components/ChunkErrorBoundary';
import { LoadingSpinner } from '@/modules/ui/components/LoadingSpinner';
import {
  LazyRewardsWidgetPane,
  LazySavingsWidgetPane,
  LazyExpertWidgetPane,
  LazyTradeWidgetPane
} from '@/lib/restricted-lazy-components';

type WidgetPaneProps = {
  intent: Intent;
  children?: React.ReactNode;
};

export const WidgetPane = ({ intent, children }: WidgetPaneProps) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const onConnect = useCustomConnectModal();
  const { isModuleAvailable, markModuleBlocked, isLoading: isPreloading } = useModuleAvailability();

  // No-op: ConnectedModal now uses subgraph data instead of localStorage
  const addRecentTransaction = () => {};

  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const onNotification = useNotification();
  const { onExternalLinkClicked } = useConfigContext();
  const { hideZeroBalances, setHideZeroBalances, showAllNetworks, setShowAllNetworks } = useBalanceFilters();
  const locale = i18n.locale;

  // Check if any modules are blocked (for hiding module balances in BalancesWidget)
  const hasBlockedModules =
    !isModuleAvailable(Intent.SAVINGS_INTENT) ||
    !isModuleAvailable(Intent.REWARDS_INTENT) ||
    !isModuleAvailable(Intent.EXPERT_INTENT);
  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  const rightHeaderComponent = <DualSwitcher className="hidden lg:flex" />;

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
    shouldReset: searchParams.get(QueryParams.Reset) === 'true',
    legalBatchTxUrl: BATCH_TX_LEGAL_NOTICE_URL
  };

  const actionForToken = useActionForToken();

  const { rewardsUrl, savingsUrlMap, sealUrl, stakeUrl, stusdsUrl } = useModuleUrls();

  // Helper to wrap lazy components with Suspense and ChunkErrorBoundary
  const wrapRestrictedWidget = (
    intentType: Intent,
    LazyComponent: React.LazyExoticComponent<React.ComponentType<SharedProps>>
  ) => (
    <ChunkErrorBoundary intent={intentType} onBlocked={markModuleBlocked}>
      <Suspense fallback={<LoadingSpinner />}>
        <LazyComponent {...sharedProps} />
      </Suspense>
    </ChunkErrorBoundary>
  );

  const widgetItems: WidgetItem[] = [
    [
      Intent.BALANCES_INTENT,
      'Balances',
      Balances,
      withErrorBoundary(
        <BalancesWidgetPane
          {...sharedProps}
          hideModuleBalances={hasBlockedModules}
          actionForToken={actionForToken}
          rewardsCardUrl={rewardsUrl}
          savingsCardUrlMap={savingsUrlMap}
          sealCardUrl={sealUrl}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={stusdsUrl}
          customTokenMap={defaultConfig.balancesTokenList}
          chainIds={getSupportedChainIds(chainId)}
          hideZeroBalances={hideZeroBalances}
          setHideZeroBalances={setHideZeroBalances}
          showAllNetworks={showAllNetworks}
          setShowAllNetworks={setShowAllNetworks}
        />
      ),
      false,
      undefined,
      'Manage your Sky Ecosystem funds across supported networks'
    ],
    [
      Intent.REWARDS_INTENT,
      'Rewards',
      RewardsModule,
      withErrorBoundary(wrapRestrictedWidget(Intent.REWARDS_INTENT, LazyRewardsWidgetPane)),
      false,
      undefined,
      'Use USDS to access Sky Token Rewards'
    ],
    [
      Intent.SAVINGS_INTENT,
      'Savings',
      Savings,
      withErrorBoundary(wrapRestrictedWidget(Intent.SAVINGS_INTENT, LazySavingsWidgetPane)),
      false,
      undefined,
      isL2ChainId(chainId)
        ? 'Use USDS or USDC to access the Sky Savings Rate'
        : 'Use USDS to access the Sky Savings Rate'
    ],
    [
      Intent.UPGRADE_INTENT,
      'Upgrade',
      Upgrade,
      withErrorBoundary(<UpgradeWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Upgrade your DAI to USDS and MKR to SKY'
    ],
    [
      Intent.TRADE_INTENT,
      'Trade',
      Trade,
      withErrorBoundary(wrapRestrictedWidget(Intent.TRADE_INTENT, LazyTradeWidgetPane)),
      false,
      undefined,
      'Trade popular tokens for Sky Ecosystem tokens'
    ],
    [
      Intent.STAKE_INTENT,
      'Stake & Borrow',
      Stake,
      withErrorBoundary(<StakeWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Stake SKY to earn rewards, delegate votes, and borrow USDS'
    ],
    [
      Intent.EXPERT_INTENT,
      'Expert',
      Expert,
      withErrorBoundary(wrapRestrictedWidget(Intent.EXPERT_INTENT, LazyExpertWidgetPane)),
      false,
      undefined,
      'Higher-risk options for more experienced users'
    ]
  ]
    // Filter out modules that are blocked by WAF (403) - only when behavior is 'hide'
    .filter(
      ([intentType]) => BLOCKED_MODULE_BEHAVIOR === 'disable' || isModuleAvailable(intentType as Intent)
    )
    .map(([intentType, label, icon, component, , , description]) => {
      const comingSoon = COMING_SOON_MAP[chainId]?.includes(intentType as Intent);
      const isBlocked = !isModuleAvailable(intentType as Intent);
      const isDisabled = comingSoon || isBlocked;
      return [
        intentType as Intent,
        label as string,
        icon as (props: IconProps) => React.ReactNode,
        isDisabled ? null : (component as React.ReactNode),
        comingSoon,
        isDisabled ? { disabled: true } : undefined,
        description as string
      ];
    }) as WidgetItem[];

  // Group the widgets in categories
  const widgetContent: WidgetContent = [
    {
      id: 'group-1',
      items: widgetItems.filter(([intent]) => intent === Intent.BALANCES_INTENT)
    },
    {
      id: 'group-2',
      items: widgetItems.filter(
        ([intent]) =>
          intent === Intent.REWARDS_INTENT ||
          intent === Intent.SAVINGS_INTENT ||
          intent === Intent.STAKE_INTENT
      )
    },
    {
      id: 'group-3',
      items: widgetItems.filter(
        ([intent]) => intent === Intent.UPGRADE_INTENT || intent === Intent.TRADE_INTENT
      )
    },
    {
      id: 'group-4',
      items: widgetItems.filter(([intent]) => intent === Intent.EXPERT_INTENT)
    }
  ];

  useEffect(() => {
    if (!searchParams.get(QueryParams.Reset)) return;

    const timer = setTimeout(() => {
      setSearchParams(prev => {
        prev.delete(QueryParams.Reset);
        return prev;
      });
    }, 500);

    return () => clearTimeout(timer); // cleanup
  }, [searchParams, setSearchParams]);

  // Show all widget items regardless of network for better discoverability
  // Auto-switching will be handled in WidgetNavigation
  const filteredWidgetContent: WidgetContent = widgetContent.filter(group => group.items.length > 0);

  // While preloading restricted modules, show a loading state
  // This ensures the menu doesn't flash items that will be removed
  if (isPreloading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <WidgetNavigation widgetContent={filteredWidgetContent} intent={intent} currentChainId={chainId}>
      {children}
    </WidgetNavigation>
  );
};
