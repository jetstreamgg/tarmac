import { Balances, Upgrade, Trade, RewardsModule, Savings, Seal } from '../../icons';
import { Intent } from '@/lib/enums';
import { useLingui } from '@lingui/react';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { CHAIN_WIDGET_MAP, COMING_SOON_MAP, mapIntentToQueryParam, restrictedIntents } from '@/lib/constants';
import { WidgetNavigation } from '@/modules/app/components/WidgetNavigation';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { DualSwitcher } from '@/components/DualSwitcher';
import { IconProps } from '@/modules/icons/Icon';
import { UpgradeWidgetPane } from '@/modules/upgrade/components/UpgradeWidgetPane';
import { RewardsWidgetPane } from '@/modules/rewards/components/RewardsWidgetPane';
import { TradeWidgetPane } from '@/modules/trade/components/TradeWidgetPane';
import { SavingsWidgetPane } from '@/modules/savings/components/SavingsWidgetPane';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import React from 'react';
import { useNotification } from '../hooks/useNotification';
import { useActionForToken } from '../hooks/useActionForToken';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useNavigate } from 'react-router-dom';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { defaultConfig } from '@/modules/config/default-config';
import { useChainId } from 'wagmi';
import { SealWidgetPane } from '@/modules/seal/components/SealWidgetPane';
import { BalancesWidgetPane } from '@/modules/balances/components/BalancesWidgetPane';

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
  const locale = i18n.locale;

  const isRestrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';
  const isRestricted = isRestrictedBuild || isRestrictedMiCa;
  const referralCode = Number(import.meta.env.VITE_REFERRAL_CODE) || 0; // fallback to 0 if invalid

  const rightHeaderComponent = <DualSwitcher />;

  const sharedProps = {
    onConnect,
    addRecentTransaction,
    locale,
    rightHeaderComponent,
    onNotification,
    enabled: isConnectedAndAcceptedTerms,
    onExternalLinkClicked,
    referralCode
  };

  const actionForToken = useActionForToken();
  const rewardsUrl = useRetainedQueryParams(`/?widget=${mapIntentToQueryParam(Intent.REWARDS_INTENT)}`);
  const savingsUrl = useRetainedQueryParams(`/?widget=${mapIntentToQueryParam(Intent.SAVINGS_INTENT)}`);
  const sealUrl = useRetainedQueryParams(`/?widget=${mapIntentToQueryParam(Intent.SEAL_INTENT)}`);
  const navigate = useNavigate();

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
          onClickRewardsCard={() => navigate(rewardsUrl)}
          onClickSavingsCard={() => navigate(savingsUrl)}
          onClickSealCard={() => navigate(sealUrl)}
          customTokenList={defaultConfig.balancesTokenList[chainId]}
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
