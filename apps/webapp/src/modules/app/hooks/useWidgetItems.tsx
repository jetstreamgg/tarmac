import { Balances, RewardsModule, Savings, Stake, Expert, Vaults, ConvertArrows, Pendle } from '../../icons';
import { Intent } from '@/lib/enums';
import { COMING_SOON_MAP } from '@/lib/constants';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { INTENT_TO_GEO_MODULE, useGeoConfig } from '@/modules/geo-config';
import { IconProps } from '@/modules/icons/Icon';
import React from 'react';

import { useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { WidgetContent, WidgetItem, WidgetSubItem } from '../types/Widgets';
import { isL2ChainId, isTestnetId } from '@/utils';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { useAvailableTokenRewardContracts, VAULTS, PENDLE_MARKETS, isMarketMatured } from '@/hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Builds the navigation metadata (label, icon, description, sub-items) for
 * every module available on the current chain and geo-config. The pane
 * content itself is route-driven. `effectiveIntent` falls back to Balances
 * when the route's module is geo-restricted.
 */
export function useWidgetItems(intent: Intent): {
  widgetContent: WidgetContent;
  effectiveIntent: Intent;
} {
  const chainId = useChainId();

  const { isModuleEnabled } = useGeoConfig();

  // If the intent maps to a restricted module, fall back to Balances
  const restrictedModuleId = INTENT_TO_GEO_MODULE[intent];
  const effectiveIntent =
    restrictedModuleId && !isModuleEnabled(restrictedModuleId) ? Intent.BALANCES_INTENT : intent;

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
      false,
      undefined,
      'Manage your Sky Ecosystem funds across supported networks'
    ],
    [
      Intent.REWARDS_INTENT,
      'Rewards',
      RewardsModule,
      false,
      undefined,
      'Use USDS to access Sky Token Rewards',
      rewardSubItems
    ],
    [
      Intent.SAVINGS_INTENT,
      'Savings',
      Savings,
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
      false,
      undefined,
      'Know your return by a pre-set maturity date. Supply USDS at a discount. Redeem for full USDS value at maturity.',
      pendleSubItems
    ],
    [
      Intent.STAKE_INTENT,
      'Stake & Borrow',
      Stake,
      false,
      undefined,
      'Stake SKY to accrue rewards, delegate votes, and borrow USDS'
    ],
    [
      Intent.VAULTS_INTENT,
      'Vaults',
      Vaults,
      false,
      undefined,
      'Third-party vault integrations with Sky Ecosystem tokens',
      vaultSubItems
    ],
    [
      Intent.EXPERT_INTENT,
      'Expert',
      Expert,
      false,
      undefined,
      'Higher-risk options for more experienced users',
      [
        {
          label: 'stUSDS',
          icon: <TokenIcon token={{ symbol: 'stUSDS' }} className="h-3 w-3" showChainIcon={false} />,
          to: '/earn/stusds'
        }
      ]
    ],
    // The E2 page-as-widget owns /convert whole: no sub-items (legacy trade and
    // upgrade surfaces are parked, pending the restore-vs-retire decision).
    [
      Intent.CONVERT_INTENT,
      'Convert',
      ConvertArrows,
      false,
      undefined,
      'Convert stablecoins at a fixed 1:1 rate'
    ]
  ]
    .filter(([intent]) => {
      const moduleId = INTENT_TO_GEO_MODULE[intent as Intent];
      return !moduleId || isModuleEnabled(moduleId);
    })
    .map(([intent, label, icon, , , description, subItems]) => {
      const comingSoon = COMING_SOON_MAP[chainId]?.includes(intent as Intent);
      const filteredSubItems = (subItems as WidgetSubItem[] | undefined)?.filter(sub => {
        if (!sub.intent) return true;
        const subModuleId = INTENT_TO_GEO_MODULE[sub.intent];
        return !subModuleId || isModuleEnabled(subModuleId);
      });
      return [
        intent as Intent,
        label as string,
        icon as (props: IconProps) => React.ReactNode,
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

  // Show all widget items regardless of network for better discoverability;
  // the header nav auto-switches to mainnet for mainnet-only modules
  const filteredWidgetContent: WidgetContent = widgetContent.filter(group => group.items.length > 0);

  return { widgetContent: filteredWidgetContent, effectiveIntent };
}
