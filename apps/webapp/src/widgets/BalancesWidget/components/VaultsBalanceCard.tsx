import { useMemo } from 'react';
import {
  usePrices,
  useAllMorphoVaultsUserAssets,
  useVaultRatesByAddress,
  useMerklRewards,
  MorphoVaultBalance
} from '@/hooks';
import { formatBigInt, formatNumber, isTestnetId, chainId } from '@/utils';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { ModuleCardVariant } from './ModulesBalances';
import { useChainId } from 'wagmi';
import { RateLineWithArrow } from '@/widgets/shared/components/ui/RateLineWithArrow';
import { ArrowRight } from 'lucide-react';
import { InteractiveStatsCardAlt } from '@/widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { Vaults as VaultsIcon } from '@/widgets/shared/components/icons/Vaults';
import {
  InteractiveStatsCardWithVaultAccordion,
  VaultBalanceForAccordion
} from '@/widgets/shared/components/ui/card/InteractiveStatsCardWithVaultAccordion';
import { UnclaimedRewards } from '@/widgets/shared/components/ui/UnclaimedRewards';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { VaultProvider } from '@/hooks/vaults/types';

/**
 * Build the vault-address → deep-link map. Each link carries the target vault's
 * own provider in `vault_module` (derived via the slice-01 mapping), so a Spark
 * vault link reads `vault_module=sky` and a Morpho one `vault_module=morpho`.
 */
export const buildVaultDeepLinkMap = (
  url: string | undefined,
  vaults: { vaultAddress: `0x${string}`; vault: { provider: VaultProvider } }[]
): Record<string, string> => {
  const map: Record<string, string> = {};
  vaults.forEach(v => {
    if (!url) {
      map[v.vaultAddress] = '';
      return;
    }
    const separator = url.includes('?') ? '&' : '?';
    map[v.vaultAddress] =
      `${url}${separator}vault=${v.vaultAddress}&vault_module=${vaultModuleForProvider(v.vault.provider)}`;
  });
  return map;
};

/**
 * Build the per-row vault balances and the blended weighted-average rate.
 *
 * Provider-neutral: rates come from `ratesByAddress` (keyed by lowercased vault
 * address), so a Spark position contributes its rate to both its own row and the
 * weighted average exactly like a Morpho one. A vault missing from the map reads
 * 0% — same fallback as before — but the map now spans every Provider.
 */
export const computeVaultBalances = ({
  vaults,
  ratesByAddress,
  vaultChainId,
  hideZeroBalances
}: {
  vaults: MorphoVaultBalance[];
  ratesByAddress: Map<string, number>;
  vaultChainId: number;
  hideZeroBalances: boolean;
}): { vaultBalances: VaultBalanceForAccordion[]; weightedAverageRate: number } => {
  let totalWeightedRate = 0n;
  let totalBalance = 0n;

  const balances = vaults.map(vaultBalance => {
    const assetDecimals =
      typeof vaultBalance.assetToken.decimals === 'number'
        ? vaultBalance.assetToken.decimals
        : (vaultBalance.assetToken.decimals[vaultChainId] ?? 18);

    // Find rate for this vault by address (any Provider)
    const rate = ratesByAddress.get(vaultBalance.vaultAddress?.toLowerCase()) ?? 0;

    // Accumulate weighted rate for positions with balance
    if (vaultBalance.balanceNormalized > 0n) {
      const rateScaled = BigInt(Math.round(rate * 1e18));
      totalWeightedRate += (vaultBalance.balanceNormalized * rateScaled) / BigInt(1e18);
      totalBalance += vaultBalance.balanceNormalized;
    }

    return {
      vaultName: vaultBalance.vault.name,
      vaultAddress: vaultBalance.vaultAddress,
      balance: vaultBalance.balance,
      balanceNormalized: vaultBalance.balanceNormalized,
      assetSymbol: vaultBalance.assetToken.symbol,
      assetDecimals,
      rate
    };
  });

  // Filter out zero balances if hideZeroBalances is enabled
  const filtered = hideZeroBalances ? balances.filter(v => v.balance > 0n) : balances;

  // Sort by normalized balance (18 decimals) to compare across different asset decimals
  const sorted: VaultBalanceForAccordion[] = filtered.sort((a, b) =>
    b.balanceNormalized > a.balanceNormalized ? 1 : b.balanceNormalized < a.balanceNormalized ? -1 : 0
  );

  const weightedRate = totalBalance > 0n ? Number(totalWeightedRate) / Number(totalBalance) : 0;

  return { vaultBalances: sorted, weightedAverageRate: weightedRate };
};

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
  // Provider-neutral rates over the whole registry (Morpho API + Spark on-chain vsr)
  const { ratesByAddress, isLoading: ratesLoading } = useVaultRatesByAddress();

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
  const maxRate = Math.max(0, ...ratesByAddress.values());

  const isBalanceLoading = morphoDataLoading;
  const isRateLoading = ratesLoading;

  const vaultsIcon = <VaultsIcon className="h-full w-full" />;

  // Build vault balances for accordion and calculate weighted average rate
  const { vaultBalances, weightedAverageRate } = useMemo(
    () =>
      computeVaultBalances({
        vaults: morphoAssetsData.vaults,
        ratesByAddress,
        vaultChainId,
        hideZeroBalances
      }),
    [morphoAssetsData.vaults, ratesByAddress, vaultChainId, hideZeroBalances]
  );

  // The blended-rate (i) tooltip is provider-specific: a portfolio holding only Sky vaults
  // (e.g. Tether Savings) gets the Sky rate tooltip — not the Morpho "vault curator on Morpho"
  // copy. Morpho-only or mixed positions keep the Morpho tooltip.
  const positionsWithBalance = morphoAssetsData.vaults.filter(v => v.balanceNormalized > 0n);
  const blendedRatePopoverType: 'morpho' | 'sky' =
    positionsWithBalance.length > 0 && positionsWithBalance.every(v => v.vault.provider === 'sky')
      ? 'sky'
      : 'morpho';

  // Build URL map for vaults with vault-specific query params
  const urlMap = useMemo(() => {
    if (vaultUrlMap) return vaultUrlMap;
    return buildVaultDeepLinkMap(url, morphoAssetsData.vaults);
  }, [vaultUrlMap, morphoAssetsData.vaults, url]);

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCardWithVaultAccordion
      title={t`Supplied to Vaults`}
      icon={vaultsIcon}
      headerRightContent={
        isBalanceLoading ? <Skeleton className="w-32" /> : <Text>{formatBigInt(morphoSupplied)}</Text>
      }
      footer={
        <div className="flex flex-col gap-1">
          {isRateLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : weightedAverageRate > 0 ? (
            <div className="flex items-center gap-2">
              <RateLineWithArrow
                rateText={t`Rate: ${(weightedAverageRate * 100).toFixed(2)}%`}
                popoverType={blendedRatePopoverType}
                onExternalLinkClicked={onExternalLinkClicked}
                showArrow={false}
              />
              {url && (
                <ArrowRight
                  size={16}
                  className="opacity-0 transition-opacity group-hover/header-link:opacity-100"
                />
              )}
            </div>
          ) : maxRate > 0 ? (
            <div className="flex items-center gap-2">
              <RateLineWithArrow
                rateText={t`Rates up to: ${(maxRate * 100).toFixed(2)}%`}
                popoverType="morpho"
                onExternalLinkClicked={onExternalLinkClicked}
                showArrow={false}
              />
              {url && (
                <ArrowRight
                  size={16}
                  className="opacity-0 transition-opacity group-hover/header-link:opacity-100"
                />
              )}
            </div>
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
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Vaults`}
      icon={vaultsIcon}
      url={url}
      logoName="vaults"
      content={isBalanceLoading ? <Skeleton className="w-32" /> : <Text>{formatBigInt(morphoSupplied)}</Text>}
    />
  );
};
