import {
  useStUsdsData,
  usePrices,
  useMorphoVaultData,
  useMorphoVaultRate,
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

  // Get Morpho vault data
  const defaultMorphoVault = MORPHO_VAULTS[0];
  const morphoVaultAddress = defaultMorphoVault?.vaultAddress[vaultChainId];
  const { data: morphoData, isLoading: morphoDataLoading } = useMorphoVaultData({
    vaultAddress: morphoVaultAddress
  });
  const { data: morphoRateData, isLoading: morphoRateLoading } = useMorphoVaultRate({
    vaultAddress: morphoVaultAddress
  });

  // Combine stUSDS and Morpho supplied amounts
  const stUsdsSupplied = stUsdsData?.userSuppliedUsds || 0n;
  const morphoSupplied = morphoData?.userAssets || 0n;
  const totalSuppliedUsds = stUsdsSupplied + morphoSupplied;

  // Calculate the higher rate between stUSDS and Morpho
  const stUsdsRate = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;
  const morphoRate = morphoRateData?.netRate ? morphoRateData.netRate * 100 : 0; // Convert decimal to percentage
  const maxRate = Math.max(stUsdsRate, morphoRate);

  // Separate loading states: balance data vs rate data
  const isBalanceLoading = stUsdsLoading || morphoDataLoading;
  const isRateLoading = morphoRateLoading || stUsdsLoading;

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`USDS supplied to Expert`}
      tokenSymbol="USDS"
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
      title={t`USDS supplied to Expert`}
      tokenSymbol="USDS"
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
