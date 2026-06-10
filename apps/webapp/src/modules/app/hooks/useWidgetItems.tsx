import {
  Balances,
  RewardsModule,
  Savings,
  Stake,
  Expert,
  Vaults,
  Convert,
  Upgrade,
  Trade,
  Pendle
} from '../../icons';
import { Intent } from '@/lib/enums';
import { COMING_SOON_MAP, ExpertIntentMapping, ConvertIntentMapping } from '@/lib/constants';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { useGeoConfig } from '@/modules/geo-config';
import { ModuleId } from '@/modules/geo-config/types';
import { ExpertIntent, ConvertIntent } from '@/lib/enums';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { RewardsWidgetPane } from '@/modules/rewards/components/RewardsWidgetPane';
import { SavingsWidgetPane } from '@/modules/savings/components/SavingsWidgetPane';
import React from 'react';

import { useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';
import { StakeWidgetPane } from '@/modules/stake/components/StakeWidgetPane';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { useBalanceFilters } from '@/modules/ui/context/BalanceFiltersContext';
import { WidgetContent, WidgetItem, WidgetSubItem } from '../types/Widgets';
import { isL2ChainId, isTestnetId } from '@/utils';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { ExpertWidgetPane } from '@/modules/expert/components/ExpertWidgetPane';
import { VaultsWidgetPane } from '@/modules/vaults/components/VaultsWidgetPane';
import { ConvertWidgetPane } from '@/modules/convert/components/ConvertWidgetPane';
import { PendleWidgetPane } from '@/modules/pendle/components/PendleWidgetPane';
import { useModuleUrls } from './useModuleUrls';
import { useAvailableTokenRewardContracts, VAULTS, PENDLE_MARKETS, isMarketMatured } from '@/hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Builds the widget items for the current chain and geo-config: nav metadata
 * (label, icon, description, sub-items) plus the legacy pane content element
 * per module. `effectiveIntent` falls back to Balances when the route's module
 * is geo-restricted.
 *
 * Transitional: the pane content slot disappears once every module route
 * renders its own widget/details pair.
 */
export function useWidgetItems(intent: Intent): {
  widgetItems: WidgetItem[];
  widgetContent: WidgetContent;
  effectiveIntent: Intent;
} {
  const chainId = useChainId();

  const { hideZeroBalances, setHideZeroBalances, showAllNetworks, setShowAllNetworks } = useBalanceFilters();

  const { isModuleEnabled, isRegionRestricted } = useGeoConfig();

  // Map Intent → ModuleId for geo-config filtering
  const intentToModule: Partial<Record<Intent, ModuleId>> = {
    [Intent.SAVINGS_INTENT]: 'savings',
    [Intent.REWARDS_INTENT]: 'rewards',
    [Intent.EXPERT_INTENT]: 'expert',
    [Intent.TRADE_INTENT]: 'trade',
    [Intent.STAKE_INTENT]: 'stake',
    [Intent.VAULTS_INTENT]: 'vaults',
    [Intent.FIXED_INTENT]: 'fixed'
  };

  // If the intent maps to a restricted module, fall back to Balances
  const restrictedModuleId = intentToModule[intent];
  const effectiveIntent =
    restrictedModuleId && !isModuleEnabled(restrictedModuleId) ? Intent.BALANCES_INTENT : intent;

  const rightHeaderComponent = <DualSwitcher className="hidden lg:flex" />;

  const sharedProps = {
    rightHeaderComponent
  };

  const { rewardsUrl, savingsUrlMap, stakeUrl, stusdsUrl, vaultsUrl, fixedYieldUrl } = useModuleUrls();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const rewardSubItems = rewardContracts
    .filter(contract => contract.rewardToken.symbol !== 'SKY')
    .map(contract => ({
      label: `${contract.rewardToken.symbol} Rewards`,
      icon: (
        <TokenIcon
          token={{ symbol: contract.rewardToken.symbol }}
          className="h-3 w-3"
          showChainIcon={false}
        />
      ),
      to: `/rewards/${contract.contractAddress}`
    }));

  // Vaults only exist on mainnet/testnet, so use appropriate chain based on environment
  const vaultChainId = isTestnetId(chainId) ? TENDERLY_CHAIN_ID : mainnet.id;
  const vaultSubItems = VAULTS.filter(vault => vault.vaultAddress[vaultChainId]).map(vault => ({
    label: vault.name,
    icon: <TokenIcon token={{ symbol: vault.assetToken.symbol }} className="h-3 w-3" showChainIcon={false} />,
    to: `/vaults/${vaultModuleForProvider(vault.provider)}/${vault.vaultAddress[vaultChainId]}`
  }));

  const pendleSubItems = PENDLE_MARKETS.filter(market => !isMarketMatured(market.expiry)).map(market => ({
    label: `PT-${market.underlyingSymbol}`,
    icon: (
      <TokenIcon
        token={{ symbol: `PT-${market.underlyingSymbol}` }}
        className="h-3 w-3"
        showChainIcon={false}
      />
    ),
    to: `/fixed/market/${market.marketAddress}`
  }));

  const widgetItems: WidgetItem[] = [
    [
      Intent.BALANCES_INTENT,
      'Balances',
      Balances,
      withErrorBoundary(
        <BalancesWidgetPane
          {...sharedProps}
          hideRestrictedModules={isRegionRestricted}
          rewardsCardUrl={isRegionRestricted ? undefined : rewardsUrl}
          savingsCardUrlMap={isRegionRestricted ? undefined : savingsUrlMap}
          stakeCardUrl={stakeUrl}
          stusdsCardUrl={isRegionRestricted ? undefined : stusdsUrl}
          vaultsCardUrl={vaultsUrl}
          fixedYieldCardUrl={fixedYieldUrl}
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
      Intent.FIXED_INTENT,
      'Fixed Yield',
      Pendle,
      withErrorBoundary(<PendleWidgetPane {...sharedProps} />),
      false,
      undefined,
      'Know your return by a pre-set maturity date. Supply USDS at a discount. Redeem for full USDS value at maturity.',
      pendleSubItems
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
      'Third-party vault integrations with Sky Ecosystem tokens',
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
          to: `/expert/${ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]}`
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
      'Get Sky Ecosystem tokens with best possible rates',
      [
        {
          label: '1:1 Conversion',
          icon: <Convert className="h-3 w-3" />,
          to: `/convert/${ConvertIntentMapping[ConvertIntent.PSM_INTENT]}`
        },
        {
          label: 'Trade',
          icon: <Trade className="h-3 w-3" />,
          to: `/convert/${ConvertIntentMapping[ConvertIntent.TRADE_INTENT]}`,
          intent: Intent.TRADE_INTENT
        },
        {
          label: 'Upgrade',
          icon: <Upgrade className="h-3 w-3" />,
          to: `/convert/${ConvertIntentMapping[ConvertIntent.UPGRADE_INTENT]}`,
          intent: Intent.UPGRADE_INTENT
        }
      ]
    ]
  ]
    .filter(([intent]) => {
      const moduleId = intentToModule[intent as Intent];
      return !moduleId || isModuleEnabled(moduleId);
    })
    .map(([intent, label, icon, component, , , description, subItems]) => {
      const comingSoon = COMING_SOON_MAP[chainId]?.includes(intent as Intent);
      const filteredSubItems = (subItems as WidgetSubItem[] | undefined)?.filter(sub => {
        if (!sub.intent) return true;
        const subModuleId = intentToModule[sub.intent];
        return !subModuleId || isModuleEnabled(subModuleId);
      });
      return [
        intent as Intent,
        label as string,
        icon as (props: IconProps) => React.ReactNode,
        comingSoon ? null : (component as React.ReactNode),
        comingSoon,
        comingSoon ? { disabled: true } : undefined,
        description as string,
        filteredSubItems
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
          intent === Intent.FIXED_INTENT ||
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

  // Show all widget items regardless of network for better discoverability
  // Auto-switching will be handled in WidgetNavigation
  const filteredWidgetContent: WidgetContent = widgetContent.filter(group => group.items.length > 0);

  return { widgetItems, widgetContent: filteredWidgetContent, effectiveIntent };
}
