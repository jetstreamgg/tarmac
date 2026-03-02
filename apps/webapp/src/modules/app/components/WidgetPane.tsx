import {
  Balances,
  RewardsModule,
  Savings,
  Stake,
  Expert,
  Vaults,
  Convert,
  Upgrade,
  Trade
} from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import {
  BATCH_TX_LEGAL_NOTICE_URL,
  COMING_SOON_MAP,
  QueryParams,
  RESTRICTED_INTENTS,
  IntentMapping,
  ExpertIntentMapping,
  VaultsIntentMapping,
  ConvertIntentMapping
} from '@/lib/constants';
import { ExpertIntent, VaultsIntent, ConvertIntent } from '@/lib/enums';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { RewardsWidgetPane } from '@/modules/rewards/components/RewardsWidgetPane';
import { SavingsWidgetPane } from '@/modules/savings/components/SavingsWidgetPane';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import React, { useEffect } from 'react';
import { useNotification } from '../hooks/useNotification';

import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

import { useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';
import { StakeWidgetPane } from '@/modules/stake/components/StakeWidgetPane';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useSearchParams } from 'react-router-dom';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { WidgetContent, WidgetItem } from '../types/Widgets';
import { isL2ChainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { ExpertWidgetPane } from '@/modules/expert/components/ExpertWidgetPane';
import { VaultsWidgetPane } from '@/modules/vaults/components/VaultsWidgetPane';
import { ConvertWidgetPane } from '@/modules/convert/components/ConvertWidgetPane';
import { useModuleUrls } from '../hooks/useModuleUrls';
import { useAvailableTokenRewardContracts, MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';

// Module-level guard: persists across React remounts/StrictMode, resets on page reload (fresh deeplink)
let lastDeeplinkTracked: string | null = null;

type WidgetPaneProps = {
  intent: Intent;
  children?: React.ReactNode;
};

export const WidgetPane = ({ intent, children }: WidgetPaneProps) => {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const onConnect = useCustomConnectModal();

  // No-op: ConnectedModal now uses subgraph data instead of localStorage
  const addRecentTransaction = () => {};

  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const onNotification = useNotification();
  const { onExternalLinkClicked } = useConfigContext();
  const { hideZeroBalances, setHideZeroBalances, showAllNetworks, setShowAllNetworks } = useBalanceFilters();
  const locale = i18n.locale;

  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
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

  const { trackWidgetSelected } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  // Deeplink detection: fire app_widget_selected when initial intent ≠ default (balances)
  // Uses module-level guard (not useRef) so it survives React StrictMode remounts and key-driven remounts
  useEffect(() => {
    if (intent && intent !== Intent.BALANCES_INTENT && intent !== lastDeeplinkTracked) {
      lastDeeplinkTracked = intent;
      startNewFlow();
      trackWidgetSelected({
        widgetName: IntentMapping[intent] || intent,
        previousWidget: IntentMapping[Intent.BALANCES_INTENT],
        selectionMethod: 'deeplink',
        chainId
      });
    }
  }, []);

  const { rewardsUrl, savingsUrlMap, sealUrl, stakeUrl, stusdsUrl, morphoUrl } = useModuleUrls();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const rewardSubItems = rewardContracts.map(contract => ({
    label: `${contract.rewardToken.symbol} Rewards`,
    icon: (
      <TokenIcon token={{ symbol: contract.rewardToken.symbol }} className="h-3 w-3" showChainIcon={false} />
    ),
    params: { [QueryParams.Reward]: contract.contractAddress }
  }));

  // Vaults only exist on mainnet/testnet, so use appropriate chain based on environment
  const vaultChainId = isTestnetId(chainId) ? TENDERLY_CHAIN_ID : mainnet.id;
  const vaultSubItems = MORPHO_VAULTS.filter(vault => vault.vaultAddress[vaultChainId]).map(vault => ({
    label: vault.name,
    icon: <TokenIcon token={{ symbol: vault.assetToken.symbol }} className="h-3 w-3" showChainIcon={false} />,
    params: {
      [QueryParams.VaultModule]: VaultsIntentMapping[VaultsIntent.MORPHO_VAULT_INTENT],
      [QueryParams.Vault]: vault.vaultAddress[vaultChainId]
    }
  }));

  const widgetItems: WidgetItem[] = [
    [
      Intent.BALANCES_INTENT,
      'Balances',
      Balances,
      withErrorBoundary(
        <BalancesWidgetPane
          {...sharedProps}
          hideModuleBalances={isRestrictedBuild}
          rewardsCardUrl={rewardsUrl}
          savingsCardUrlMap={savingsUrlMap}
          sealCardUrl={sealUrl}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={stusdsUrl}
          morphoCardUrl={morphoUrl}
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
      withErrorBoundary(<RewardsWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Use USDS to access Sky Token Rewards',
      rewardSubItems
    ],
    [
      Intent.SAVINGS_INTENT,
      'Savings',
      Savings,
      withErrorBoundary(<SavingsWidgetPane {...sharedProps} />),
      false,
      undefined,
      isL2ChainId(chainId)
        ? 'Use USDS or USDC to access the Sky Savings Rate'
        : 'Use USDS to access the Sky Savings Rate'
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
      Intent.VAULTS_INTENT,
      'Vaults',
      Vaults,
      withErrorBoundary(<VaultsWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Third-party vault integrations with Sky ecosystem tokens',
      vaultSubItems
    ],
    [
      Intent.EXPERT_INTENT,
      'Expert',
      Expert,
      withErrorBoundary(<ExpertWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Higher-risk options for more experienced users',
      [
        {
          label: 'stUSDS',
          icon: <TokenIcon token={{ symbol: 'stUSDS' }} className="h-3 w-3" showChainIcon={false} />,
          params: { [QueryParams.ExpertModule]: ExpertIntentMapping[ExpertIntent.STUSDS_INTENT] }
        }
      ]
    ],
    [
      Intent.CONVERT_INTENT,
      'Convert',
      Convert,
      withErrorBoundary(<ConvertWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Upgrade legacy tokens or trade for Sky ecosystem tokens',
      [
        {
          label: 'Upgrade',
          icon: <Upgrade className="h-3 w-3" />,
          params: { [QueryParams.ConvertModule]: ConvertIntentMapping[ConvertIntent.UPGRADE_INTENT] },
          intent: Intent.UPGRADE_INTENT
        },
        {
          label: 'Trade',
          icon: <Trade className="h-3 w-3" />,
          params: { [QueryParams.ConvertModule]: ConvertIntentMapping[ConvertIntent.TRADE_INTENT] }
        }
      ]
    ]
  ]
    .filter(([intent]) => !RESTRICTED_INTENTS.includes(intent as Intent))
    .map(([intent, label, icon, component, , , description, subItems]) => {
      const comingSoon = COMING_SOON_MAP[chainId]?.includes(intent as Intent);
      return [
        intent as Intent,
        label as string,
        icon as (props: IconProps) => React.ReactNode,
        comingSoon ? null : (component as React.ReactNode),
        comingSoon,
        comingSoon ? { disabled: true } : undefined,
        description as string,
        subItems
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
          intent === Intent.SAVINGS_INTENT ||
          intent === Intent.REWARDS_INTENT ||
          intent === Intent.STAKE_INTENT
      )
    },
    {
      id: 'group-3',
      items: widgetItems.filter(([intent]) => intent === Intent.VAULTS_INTENT)
    },
    {
      id: 'group-4',
      items: widgetItems.filter(([intent]) => intent === Intent.EXPERT_INTENT)
    },
    {
      id: 'group-5',
      items: widgetItems.filter(([intent]) => intent === Intent.CONVERT_INTENT)
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

  return (
    <WidgetNavigation widgetContent={filteredWidgetContent} intent={intent} currentChainId={chainId}>
      {children}
    </WidgetNavigation>
  );
};
