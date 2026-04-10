import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChainId, useChains } from 'wagmi';
import { QueryParams, mapQueryParamToIntent } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { isMultichain } from '@/lib/widget-network-map';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import {
  TOKENS,
  useOverallSkyData,
  useStUsdsData,
  useMorphoVaultMultipleRateApiData,
  MORPHO_VAULTS,
  useAvailableTokenRewardContracts,
  useRewardsChartInfo,
  useHighestRateFromChartData,
  filterDeprecatedRewardContracts,
  useStakeRewardContracts,
  useMultipleRewardsChartInfo
} from '@jetstreamgg/sky-hooks';
import { formatDecimalPercentage, calculateApyFromStr, isTestnetId, isMainnetId, chainId as chainIdConstants } from '@jetstreamgg/sky-utils';
import { Savings, Upgrade, RewardsModule, Stake, Expert, Vaults, Trade, Convert } from '@/modules/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { type IconProps } from '@/modules/icons/Icon';
import { Morpho, PopoverRateInfo, type PopoverTooltipType } from '@jetstreamgg/sky-widgets';
import { useGeoConfig } from '@/modules/geo-config';
import type { ModuleId } from '@/modules/geo-config';

type BalancesAction = {
  label: string;
  tokens: string[];
  module: 'convert' | 'morpho' | 'rewards' | 'savings' | 'stusds' | 'stake' | 'trade' | 'upgrade';
  url: string;
  rateKey?: 'vaults' | 'rewards' | 'savings' | 'stusds' | 'staking';
  badge?: string;
  showMorphoIcon?: boolean;
  subtitle?: string;
};

const STABLE_ACTIONS: BalancesAction[] = [
  {
    label: 'Vaults: USDS, USDT, USDC',
    tokens: ['USDS', 'USDC', 'USDT'],
    rateKey: 'vaults',
    subtitle: 'Rates up to {rate}',
    module: 'morpho',
    url: '?widget=vaults'
  },
  {
    label: 'Rewards and Points',
    tokens: ['SPK', 'CLE'],
    rateKey: 'rewards',
    subtitle: 'Rates up to {rate}',
    module: 'rewards',
    url: '?widget=rewards'
  },
  {
    label: 'Sky Savings Rate (sUSDS)',
    tokens: ['sUSDS'],
    rateKey: 'savings',
    subtitle: 'Rate: {rate}',
    module: 'savings',
    url: '?widget=savings'
  },
  {
    label: 'Expert: stUSDS',
    tokens: ['stUSDS'],
    rateKey: 'stusds',
    subtitle: 'Rate: {rate}',
    module: 'stusds',
    url: '?widget=expert&expert_module=stusds'
  }
];

const SKY_ACTIONS: BalancesAction[] = [
  {
    label: 'Stake and Earn with SKY',
    tokens: ['SKY'],
    rateKey: 'staking',
    subtitle: 'Rate: {rate}',
    module: 'stake',
    url: '?widget=stake'
  },
  {
    label: 'Borrow USDS',
    tokens: ['USDS'],
    module: 'stake',
    subtitle: 'Minimum borrow amount is 30K USDS',
    url: '?widget=stake'
  }
];

const TOKEN_ACTIONS: BalancesAction[] = [
  {
    label: '1:1 Conversion',
    tokens: ['USDC', 'USDS'],
    module: 'convert',
    subtitle: 'Convert USDC and USDS at a fixed 1:1 rate',
    url: '?widget=convert&convert_module=psm&source_token=USDC'
  },
  {
    label: 'Get USDS',
    tokens: ['USDS'],
    module: 'trade',
    url: '?widget=convert&convert_module=trade&target_token=USDS'
  },
  {
    label: 'Get SKY',
    tokens: ['SKY'],
    module: 'trade',
    url: '?widget=convert&convert_module=trade&target_token=SKY'
  },
  {
    label: 'Upgrade DAI to USDS',
    tokens: ['DAI', 'USDS'],
    module: 'upgrade',
    url: '?widget=convert&convert_module=upgrade&source_token=DAI'
  },
  {
    label: 'Upgrade MKR to SKY',
    tokens: ['MKR', 'SKY'],
    module: 'upgrade',
    url: '?widget=convert&convert_module=upgrade&source_token=MKR'
  }
];

const MODULE_ICONS: Record<BalancesAction['module'], (props: IconProps) => React.ReactElement> = {
  convert: Convert,
  savings: Savings,
  upgrade: Upgrade,
  trade: Trade,
  rewards: RewardsModule,
  stake: Stake,
  stusds: Expert,
  morpho: Vaults
};

const RATE_TOOLTIP_TYPES: Record<NonNullable<BalancesAction['rateKey']>, PopoverTooltipType> = {
  vaults: 'morpho',
  rewards: 'str',
  savings: 'ssr',
  stusds: 'stusds',
  staking: 'srr'
};

function resolveAction(action: BalancesAction, rateMap: Record<string, string>): { label: string; subtitle?: string } {
  let label = action.label;
  let subtitle = action.subtitle;

  if (action.rateKey) {
    const rate = rateMap[action.rateKey] ?? '';
    label = label.replace('{rate}', rate);
    if (subtitle) {
      subtitle = subtitle.replace('{rate}', rate);
    }
  }

  return { label, subtitle };
}

function useActionRates(actions: BalancesAction[], chainId: number): { rates: Record<string, string>; loading: Record<string, boolean> } {
  const rateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const action of actions) {
      if (action.rateKey) keys.add(action.rateKey);
    }
    return keys;
  }, [actions]);

  const hasRates = rateKeys.size > 0;
  const mainnetChainId = isTestnetId(chainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;

  const { data: overallSkyData, isLoading: savingsLoading } = useOverallSkyData();
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();

  const vaultAddresses = useMemo(
    () => MORPHO_VAULTS.map(v => v.vaultAddress[mainnetChainId]),
    [mainnetChainId]
  );
  const { data: morphoRatesData, isLoading: vaultsLoading } = useMorphoVaultMultipleRateApiData({ vaultAddresses });

  const allRewardContracts = useAvailableTokenRewardContracts(mainnetChainId);
  const activeRewardContracts = filterDeprecatedRewardContracts(allRewardContracts, mainnetChainId);

  const usdsSpkRewardContract = activeRewardContracts.find(
    contract =>
      contract.supplyToken.symbol === TOKENS.usds.symbol && contract.rewardToken.symbol === TOKENS.spk.symbol
  );
  const usdsCleRewardContract = activeRewardContracts.find(
    contract =>
      contract.supplyToken.symbol === TOKENS.usds.symbol && contract.rewardToken.symbol === TOKENS.cle.symbol
  );

  const { data: usdsSpkChartData, isLoading: spkLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsSpkRewardContract?.contractAddress as string
  });
  const { data: usdsCleChartData, isLoading: cleLoading } = useRewardsChartInfo({
    rewardContractAddress: usdsCleRewardContract?.contractAddress as string
  });
  const rewardsHighestRate = useHighestRateFromChartData([usdsSpkChartData, usdsCleChartData]);
  const rewardsLoading = spkLoading || cleLoading;

  const { data: stakeRewardContracts, isLoading: stakeContractsLoading } = useStakeRewardContracts();
  const { data: stakeRewardsChartsInfoData, isLoading: stakeChartsLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: stakeRewardContracts?.map(c => c.contractAddress) || []
  });
  const stakeHighestRateData = useHighestRateFromChartData(stakeRewardsChartsInfoData || []);
  const stakingLoading = stakeContractsLoading || stakeChartsLoading;

  return useMemo(() => {
    if (!hasRates) return { rates: {}, loading: {} };

    const rates: Record<string, string> = {};
    const loading: Record<string, boolean> = {};

    if (rateKeys.has('savings')) {
      loading.savings = savingsLoading;
      const rawRate = overallSkyData?.skySavingsRatecRate;
      if (rawRate != null) {
        const rate = parseFloat(rawRate);
        rates.savings = !isNaN(rate) ? formatDecimalPercentage(rate) : '—';
      } else {
        rates.savings = '—';
      }
    }

    if (rateKeys.has('stusds')) {
      loading.stusds = stUsdsLoading;
      if (stUsdsData?.moduleRate != null) {
        const rate = calculateApyFromStr(stUsdsData.moduleRate);
        rates.stusds = !isNaN(rate) ? `${rate.toFixed(2)}%` : '—';
      } else {
        rates.stusds = '—';
      }
    }

    if (rateKeys.has('vaults')) {
      loading.vaults = vaultsLoading;
      if (morphoRatesData != null && morphoRatesData.length > 0) {
        const maxRate = morphoRatesData.reduce((max, r) => Math.max(max, r.netRate), 0);
        const rate = maxRate * 100;
        rates.vaults = `${rate.toFixed(2)}%`;
      } else {
        rates.vaults = '—';
      }
    }

    if (rateKeys.has('rewards')) {
      loading.rewards = rewardsLoading;
      if (rewardsHighestRate?.rate != null) {
        const rate = parseFloat(rewardsHighestRate.rate);
        rates.rewards = !isNaN(rate) ? formatDecimalPercentage(rate) : '—';
      } else {
        rates.rewards = '—';
      }
    }

    if (rateKeys.has('staking')) {
      loading.staking = stakingLoading;
      if (stakeHighestRateData?.rate != null) {
        const rate = parseFloat(stakeHighestRateData.rate);
        rates.staking = !isNaN(rate) ? formatDecimalPercentage(rate) : '—';
      } else {
        rates.staking = '—';
      }
    }

    return { rates, loading };
  }, [hasRates, rateKeys, overallSkyData, stUsdsData, morphoRatesData, rewardsHighestRate, stakeHighestRateData, savingsLoading, stUsdsLoading, vaultsLoading, rewardsLoading, stakingLoading]);
}

export function BalancesSuggestedActions({
  widget,
  variant = 'default',
  restrictedModules
}: {
  widget: 'stables' | 'sky' | 'tokens';
  variant?: 'default' | 'card' | 'card-sm';
  restrictedModules?: string[];
}) {
  const [, setSearchParams] = useSearchParams();
  const chainId = useChainId();
  const chains = useChains();
  const { setIsSwitchingNetwork } = useNetworkSwitch();

  const connectedChain = chains.find(c => c.id === chainId);
  const networkName = connectedChain ? normalizeUrlParam(connectedChain.name) : 'ethereum';

  // Use current chain if it's mainnet or tenderly, otherwise default to mainnet
  const mainnetChainId = isMainnetId(chainId) ? chainId : chainIdConstants.mainnet;

  // Determine the target network name based on module's network requirements
  const getTargetNetworkName = useCallback(
    (module: string | undefined): string => {
      if (!module) return networkName;

      const targetIntent = mapQueryParamToIntent(module);

      // For multichain intents, use current network; for mainnet-only, use mainnet
      if (isMultichain(targetIntent)) {
        return networkName;
      }

      const mainnetChain = chains.find(c => c.id === mainnetChainId);
      return mainnetChain ? normalizeUrlParam(mainnetChain.name) : 'ethereum';
    },
    [networkName, chains, mainnetChainId]
  );

  const { isModuleEnabled } = useGeoConfig();

  // Map action module names to geo-config ModuleId where applicable
  const actionModuleToGeoModule: Partial<Record<BalancesAction['module'], ModuleId>> = {
    trade: 'trade'
  };

  const actions = useMemo(() => {
    let result = widget === 'stables' ? STABLE_ACTIONS : widget === 'sky' ? SKY_ACTIONS : TOKEN_ACTIONS;
    if (restrictedModules) {
      result = result.filter(action => restrictedModules.includes(action.module));
    }
    result = result.filter(action => {
      const geoModuleId = actionModuleToGeoModule[action.module];
      return !geoModuleId || isModuleEnabled(geoModuleId);
    });
    return result;
  }, [widget, restrictedModules, isModuleEnabled]);

  const { rates: rateMap, loading: rateLoading } = useActionRates(actions, chainId);

  const handleClick = useCallback(
    (action: BalancesAction) => {
      // Determine target network based on module's network requirements
      const targetNetworkName = getTargetNetworkName(action.module);
      const isNetworkChange = targetNetworkName !== networkName;

      const params = new URLSearchParams(action.url.replace(/^\?/, ''));
      params.delete(QueryParams.InputAmount);
      params.set(QueryParams.Network, targetNetworkName);

      // Show switching UI if changing networks
      if (isNetworkChange) {
        setIsSwitchingNetwork(true);
      }

      setSearchParams(prev => {
        const next = new URLSearchParams();
        [QueryParams.Locale, QueryParams.Details, QueryParams.Chat].forEach(param => {
          const value = prev.get(param);
          if (value !== null) next.set(param, value);
        });
        params.forEach((value, key) => {
          next.set(key, value);
        });
        return next;
      });
    },
    [networkName, getTargetNetworkName, setIsSwitchingNetwork, setSearchParams]
  );

  if (actions.length === 0) return null;

  if (variant === 'card') {
    return (
      <div className="@container">
        <div className="grid grid-cols-1 gap-2 @[600px]:grid-cols-2">
          {actions.map(action => {
            const resolved = resolveAction(action, rateMap);
            const ModuleIcon = MODULE_ICONS[action.module];
            return (
              <button
                key={action.label}
                onClick={() => handleClick(action)}
                className="bg-card hover:from-primary-start/100 hover:to-primary-end/100 flex cursor-pointer items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-colors hover:bg-radial-(--gradient-position)"
              >
                <ModuleIcon boxSize={20} className="text-textSecondary shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text className="text-text truncate">{resolved.label}</Text>
                  {resolved.subtitle && (
                    action.rateKey && rateLoading[action.rateKey] ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <Text variant="small" className={`flex items-center gap-1 ${action.rateKey && rateMap[action.rateKey] !== '—' ? 'text-bullish' : 'text-textSecondary'}`}>
                        {resolved.subtitle}
                        {action.rateKey && rateMap[action.rateKey] !== '—' && (
                          <PopoverRateInfo
                            type={RATE_TOOLTIP_TYPES[action.rateKey]}
                            width={12}
                            height={12}
                            iconClassName="text-textSecondary"
                          />
                        )}
                      </Text>
                    )
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {action.badge && (
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        action.showMorphoIcon
                          ? 'bg-[#2973FF]/15 text-[#2973FF]'
                          : 'bg-textEmphasis/15 text-textEmphasis'
                      }`}
                    >
                      {action.showMorphoIcon && <Morpho className="h-3.5 w-3.5 rounded-sm" />}
                      {action.badge}
                    </span>
                  )}
                  <div className="flex -space-x-1.5">
                    {action.tokens.map(symbol => (
                      <TokenIcon
                        key={symbol}
                        token={{ symbol, name: symbol }}
                        className="h-5 w-5"
                        width={20}
                        showChainIcon={false}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'card-sm') {
    const featuredAction = widget === 'tokens' ? actions[0] : undefined;
    const compactActions = widget === 'tokens' ? actions.slice(1) : actions;

    return (
      <div className="@container">
        <div className="space-y-2">
          {featuredAction && (
            (() => {
              const resolved = resolveAction(featuredAction, rateMap);
              const ModuleIcon = MODULE_ICONS[featuredAction.module];
              return (
                <button
                  key={featuredAction.label}
                  onClick={() => handleClick(featuredAction)}
                  className="from-primary-start/15 to-primary-end/15 hover:from-primary-start/25 hover:to-primary-end/25 border-primary-start/30 bg-radial-(--gradient-position) flex w-full cursor-pointer items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-[background-color,background-image]"
                >
                  <ModuleIcon boxSize={20} className="text-textSecondary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Text className="text-text">{resolved.label}</Text>
                    {resolved.subtitle && (
                      <Text variant="small" className="text-textSecondary">
                        {resolved.subtitle}
                      </Text>
                    )}
                  </div>
                  <div className="flex shrink-0 -space-x-1.5">
                    {featuredAction.tokens.map(symbol => (
                      <TokenIcon
                        key={symbol}
                        token={{ symbol, name: symbol }}
                        className="h-5 w-5"
                        width={20}
                        showChainIcon={false}
                      />
                    ))}
                  </div>
                </button>
              );
            })()
          )}

          <div className="grid grid-cols-1 gap-1 @[600px]:grid-cols-2">
            {compactActions.map(action => {
              const resolved = resolveAction(action, rateMap);
              const ModuleIcon = MODULE_ICONS[action.module];
              return (
                <button
                  key={action.label}
                  onClick={() => handleClick(action)}
                  className="bg-card hover:from-primary-start/100 hover:to-primary-end/100 flex cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2 text-left transition-colors hover:bg-radial-(--gradient-position)"
                >
                  <ModuleIcon boxSize={16} className="text-textSecondary shrink-0" />
                  <Text variant="small" className="text-text min-w-0 flex-1">
                    {resolved.label}
                  </Text>
                  <div className="flex shrink-0 items-center gap-2">
                    {action.badge && (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          action.showMorphoIcon
                            ? 'bg-[#2973FF]/15 text-[#2973FF]'
                            : 'bg-textEmphasis/15 text-textEmphasis'
                        }`}
                      >
                        {action.showMorphoIcon && <Morpho className="h-3 w-3 rounded-sm" />}
                        {action.badge}
                      </span>
                    )}
                    <div className="flex -space-x-1.5">
                      {action.tokens.map(symbol => (
                        <TokenIcon
                          key={symbol}
                          token={{ symbol, name: symbol }}
                          className="h-5 w-5"
                          width={20}
                          showChainIcon={false}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-1 @[600px]:grid-cols-2">
        {actions.map(action => {
          const resolved = resolveAction(action, rateMap);
          const ModuleIcon = MODULE_ICONS[action.module];
          return (
            <button
              key={action.label}
              onClick={() => handleClick(action)}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-left transition-colors hover:bg-brandLight/20"
            >
              <ModuleIcon boxSize={16} className="text-textSecondary shrink-0" />
              <div className="flex -space-x-1.5">
                {action.tokens.map(symbol => (
                  <TokenIcon
                    key={symbol}
                    token={{ symbol, name: symbol }}
                    className="h-5 w-5"
                    width={20}
                    showChainIcon={false}
                  />
                ))}
              </div>
              <Text variant="small" className="text-textSecondary">
                {resolved.label}
              </Text>
              {action.badge && (
                <span
                  className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    action.showMorphoIcon
                      ? 'bg-[#2973FF]/15 text-[#2973FF]'
                      : 'bg-textEmphasis/15 text-textEmphasis'
                  }`}
                >
                  {action.showMorphoIcon && <Morpho className="h-3 w-3 rounded-sm" />}
                  {action.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
