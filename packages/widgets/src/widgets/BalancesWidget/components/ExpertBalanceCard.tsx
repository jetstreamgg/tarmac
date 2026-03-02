import {
  useStUsdsData,
  usePrices,
  useAllMorphoVaultsUserAssets,
  useMorphoVaultMultipleRateApiData,
  MORPHO_VAULTS
} from '@jetstreamgg/sky-hooks';
import {
  chainId,
  formatBigInt,
  formatNumber,
  calculateApyFromStr,
  isTestnetId
} from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';
import { useChainId } from 'wagmi';

export const ExpertBalanceCard = ({
  url,
  onExternalLinkClicked,
  loading,
  variant = ModuleCardVariant.default
}: CardProps) => {
  const connectedChainId = useChainId();
  const vaultChainId = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Get aggregate Morpho vault on-chain data
  const { data: totalMorphoUserAssets, isLoading: morphoDataLoading } = useAllMorphoVaultsUserAssets();

  // Get Morpho vault rates for all vaults
  const { data: morphoRatesData, isLoading: morphoRatesLoading } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: MORPHO_VAULTS.map(v => v.vaultAddress[vaultChainId])
  });

  // Combine stUSDS and Morpho supplied amounts
  const stUsdsSupplied = stUsdsData?.userSuppliedUsds || 0n;
  const totalSuppliedUsds = stUsdsSupplied + totalMorphoUserAssets;

  // Calculate the higher rate between stUSDS and all Morpho vaults
  const stUsdsRate = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;
  const morphoMaxRate = (morphoRatesData || []).reduce((max, rate) => Math.max(max, rate.netRate * 100), 0);
  const maxRate = Math.max(stUsdsRate, morphoMaxRate);

  // Separate loading states: balance data vs rate data
  const isBalanceLoading = stUsdsLoading || morphoDataLoading;
  const isRateLoading = morphoRatesLoading || stUsdsLoading;

  const expertIcon = <img src="/images/expert_icon_large.svg" alt="Expert" className="h-full w-full" />;

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Expert`}
      icon={expertIcon}
      headerRightContent={
        loading || isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(totalSuppliedUsds)}</Text>
        )
      }
      footer={
        isRateLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : maxRate > 0 ? (
          <RateLineWithArrow
            rateText={t`Rates up to: ${maxRate.toFixed(2)}%`}
            popoverType="expert"
            onExternalLinkClicked={onExternalLinkClicked}
          />
        ) : (
          <></>
        )
      }
      footerRightContent={
        loading || pricesLoading || isBalanceLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : totalSuppliedUsds > 0n && !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(
              parseFloat(formatUnits(totalSuppliedUsds, 18)) * parseFloat(pricesData.USDS.price),
              {
                maxDecimals: 2
              }
            )}
          </Text>
        ) : undefined
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`Supplied to Expert`}
      icon={expertIcon}
      url={url}
      logoName="expert"
      content={
        loading || isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(totalSuppliedUsds)} USDS</Text>
        )
      }
    />
  );
};
