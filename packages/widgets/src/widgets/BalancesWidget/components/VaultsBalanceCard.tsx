import { useMemo } from 'react';
import {
  usePrices,
  useAllMorphoVaultsUserAssets,
  useMorphoVaultMultipleRateApiData,
  useMerklRewards,
  MORPHO_VAULTS
} from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatNumber, isTestnetId, chainId } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { ModuleCardVariant } from './ModulesBalances';
import { useChainId } from 'wagmi';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { Vaults as VaultsIcon } from '@widgets/shared/components/icons/Vaults';
import {
  InteractiveStatsCardWithVaultAccordion,
  VaultBalanceForAccordion
} from '@widgets/shared/components/ui/card/InteractiveStatsCardWithVaultAccordion';
import { UnclaimedRewards } from '@widgets/shared/components/ui/UnclaimedRewards';

export const VaultsBalanceCard = ({
  url,
  vaultUrlMap,
  onExternalLinkClicked,
  variant = ModuleCardVariant.default,
  hideZeroBalances = false
}: {
  url?: string;
  vaultUrlMap?: Record<string, string>;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  variant?: ModuleCardVariant;
  hideZeroBalances?: boolean;
}) => {
  const connectedChainId = useChainId();
  const vaultChainId = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const { data: morphoAssetsData, isLoading: morphoDataLoading } = useAllMorphoVaultsUserAssets();
  const { data: morphoRatesData, isLoading: morphoRatesLoading } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: MORPHO_VAULTS.map(v => v.vaultAddress[vaultChainId])
  });

  const { data: pricesData, isLoading: pricesLoading } = usePrices();
  const { data: rewardsData, isLoading: rewardsLoading } = useMerklRewards();

  // Get vault-only unclaimed rewards (excludes "Other campaigns")
  const unclaimedRewardsLoading = rewardsLoading;

  // Filter to only include rewards from supported vaults (not "Other campaigns")
  const { totalUnclaimedRewardsValue, uniqueRewardTokens } = useMemo(() => {
    if (!rewardsData?.rewards) return { totalUnclaimedRewardsValue: 0, uniqueRewardTokens: [] };

    let totalUsd = 0;
    const tokens: string[] = [];

    for (const reward of rewardsData.rewards) {
      // Filter to vault sources only (has vaultAddress, excludes "Other campaigns")
      const vaultSources = reward.sources.filter(s => s.vaultAddress);
      if (vaultSources.length === 0) continue;

      // Sum the vault-only amounts for this token
      const vaultOnlyAmount = vaultSources.reduce((sum, s) => sum + s.amount, 0n);
      if (vaultOnlyAmount > 0n) {
        // Calculate USD value for vault-only portion
        const vaultOnlyUsd =
          parseFloat(formatUnits(vaultOnlyAmount, reward.tokenDecimals)) * reward.tokenPrice;
        totalUsd += vaultOnlyUsd;
        tokens.push(reward.tokenSymbol);
      }
    }

    return { totalUnclaimedRewardsValue: totalUsd, uniqueRewardTokens: tokens };
  }, [rewardsData?.rewards]);

  const morphoSupplied = morphoAssetsData.total;
  const morphoMaxRate = (morphoRatesData || []).reduce((max, rate) => Math.max(max, rate.netRate), 0);

  const isBalanceLoading = morphoDataLoading;
  const isRateLoading = morphoRatesLoading;

  const vaultsIcon = <VaultsIcon className="h-full w-full" />;

  // Build vault balances for accordion, sorted by highest balance first
  const vaultBalances: VaultBalanceForAccordion[] = useMemo(() => {
    // Get vault addresses in the same order as MORPHO_VAULTS (used for rate query)
    const vaultAddressesForRates = MORPHO_VAULTS.map(v => v.vaultAddress[vaultChainId]?.toLowerCase());

    const balances = morphoAssetsData.vaults.map(vaultBalance => {
      const assetDecimals =
        typeof vaultBalance.assetToken.decimals === 'number'
          ? vaultBalance.assetToken.decimals
          : vaultBalance.assetToken.decimals[vaultChainId] ?? 18;

      // Find rate for this vault by matching index (rates are returned in same order as input addresses)
      const vaultIndex = vaultAddressesForRates.indexOf(vaultBalance.vaultAddress?.toLowerCase());
      const rateData = vaultIndex >= 0 ? morphoRatesData?.[vaultIndex] : undefined;

      return {
        vaultName: vaultBalance.vault.name,
        vaultAddress: vaultBalance.vaultAddress,
        balance: vaultBalance.balance,
        // Use normalized balance for sorting (all normalized to 18 decimals)
        balanceNormalized: vaultBalance.balanceNormalized,
        assetSymbol: vaultBalance.assetToken.symbol,
        assetDecimals,
        rate: rateData?.netRate
      };
    });

    // Filter out zero balances if hideZeroBalances is enabled
    const filtered = hideZeroBalances ? balances.filter(v => v.balance > 0n) : balances;

    // Sort by normalized balance (18 decimals) to compare across different asset decimals
    return filtered.sort((a, b) =>
      b.balanceNormalized > a.balanceNormalized ? 1 : b.balanceNormalized < a.balanceNormalized ? -1 : 0
    );
  }, [morphoAssetsData.vaults, morphoRatesData, vaultChainId, hideZeroBalances]);

  // Build URL map for vaults with vault-specific query params
  const urlMap = useMemo(() => {
    if (vaultUrlMap) return vaultUrlMap;
    // Create a map with vault address query param appended to base url
    const map: Record<string, string> = {};
    morphoAssetsData.vaults.forEach(v => {
      if (!url) {
        map[v.vaultAddress] = '';
        return;
      }
      // Parse the base URL and append vault query param
      const separator = url.includes('?') ? '&' : '?';
      map[v.vaultAddress] = `${url}${separator}vault=${v.vaultAddress}`;
    });
    return map;
  }, [vaultUrlMap, morphoAssetsData.vaults, url]);

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCardWithVaultAccordion
      title={t`Supplied to Vaults`}
      icon={vaultsIcon}
      headerRightContent={
        isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(morphoSupplied)}</Text>
        )
      }
      footer={
        <div className="flex flex-col gap-1">
          {isRateLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : morphoMaxRate > 0 ? (
            <RateLineWithArrow
              rateText={t`Rates up to: ${(morphoMaxRate * 100).toFixed(2)}%`}
              popoverType="morpho"
              onExternalLinkClicked={onExternalLinkClicked}
            />
          ) : (
            <></>
          )}
          {uniqueRewardTokens.length > 0 && <UnclaimedRewards uniqueRewardTokens={uniqueRewardTokens} />}
        </div>
      }
      footerRightContent={
        isBalanceLoading || pricesLoading || unclaimedRewardsLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Text variant="small" className="text-textSecondary leading-4">
              $
              {formatNumber(
                pricesData?.USDS
                  ? parseFloat(formatUnits(morphoSupplied, 18)) * parseFloat(pricesData.USDS.price)
                  : 0,
                {
                  maxDecimals: 2
                }
              )}
            </Text>
            {totalUnclaimedRewardsValue > 0 && (
              <Text variant="small" className="text-textPrimary leading-4">
                ${formatNumber(totalUnclaimedRewardsValue, { maxDecimals: 2 })}
              </Text>
            )}
          </div>
        )
      }
      vaultBalances={vaultBalances}
      urlMap={urlMap}
      pricesData={pricesData ?? {}}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Vaults`}
      icon={vaultsIcon}
      url={url}
      logoName="vaults"
      content={
        isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(morphoSupplied)}</Text>
        )
      }
    />
  );
};
