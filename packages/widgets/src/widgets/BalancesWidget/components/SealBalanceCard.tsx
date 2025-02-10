import { useTotalUserSealed, useSealRewardsData, usePrices } from '@jetstreamgg/hooks';
import { formatBigInt, formatNumber } from '@jetstreamgg/utils';
import { Text } from '@/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { PopoverRateInfo } from '@/shared/components/ui/PopoverRateInfo';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';

export const SealBalanceCard = ({ url, onExternalLinkClicked }: CardProps) => {
  const {
    data: totalUserSealed,
    isLoading: totalUserSealedLoading,
    error: totalUserSealedError
  } = useTotalUserSealed();

  const {
    data: sealRewardsData,
    isLoading: sealRewardsDataLoading,
    error: sealRewardsDataError
  } = useSealRewardsData();

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const sortedSealRewardsData = sealRewardsData ? [...sealRewardsData].sort((a, b) => b.rate - a.rate) : [];
  const highestSealRewardsRate = sortedSealRewardsData.length > 0 ? sortedSealRewardsData[0].rate : null;

  if (totalUserSealedError || sealRewardsDataError) return null;

  return (
    <InteractiveStatsCard
      title={t`MKR supplied to Seal Engine`}
      tokenSymbol="MKR"
      headerRightContent={
        totalUserSealedLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${totalUserSealed ? formatBigInt(totalUserSealed) : '0'}`}</Text>
        )
      }
      footer={
        sealRewardsDataLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : highestSealRewardsRate ? (
          <div className="flex w-fit items-center gap-1.5">
            <Text variant="small" className="text-bullish leading-4">
              {`Rates up to: ${highestSealRewardsRate}%`}
            </Text>
            <PopoverRateInfo
              type="srr"
              onExternalLinkClicked={onExternalLinkClicked}
              iconClassName="h-[13px] w-[13px]"
            />
          </div>
        ) : (
          <></>
        )
      }
      footerRightContent={
        totalUserSealedLoading || pricesLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : totalUserSealed !== undefined && !!pricesData?.MKR ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(parseFloat(formatUnits(totalUserSealed, 18)) * parseFloat(pricesData.MKR.price), {
              maxDecimals: 2
            })}
          </Text>
        ) : undefined
      }
      url={url}
    />
  );
};
