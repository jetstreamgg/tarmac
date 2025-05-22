import { usePrices } from '@jetstreamgg/hooks';
import { formatBigInt, formatNumber } from '@jetstreamgg/utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps } from './ModulesBalances';
import { PopoverRateInfo } from '@widgets/shared/components/ui/PopoverRateInfo';

export const StakeBalanceCard = ({ loading, stakeBalance, url, onExternalLinkClicked }: CardProps) => {
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const totalStakedValue =
    stakeBalance && pricesData?.SKY
      ? parseFloat(formatUnits(stakeBalance, 18)) * parseFloat(pricesData.SKY.price)
      : 0;

  if (totalStakedValue === 0) {
    return null;
  }

  return (
    <InteractiveStatsCard
      title={t`SKY supplied to Staking Engine`}
      tokenSymbol="SKY"
      headerRightContent={
        loading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{`${stakeBalance ? formatBigInt(stakeBalance) : '0'}`}</Text>
        )
      }
      footer={
        <div className="z-[99999] flex w-fit items-center gap-1.5">
          <Text variant="small" className="leading-4">
            {/* TODO update once rewards go live */}
            Rate: 0%
          </Text>
          <PopoverRateInfo
            type="srr"
            onExternalLinkClicked={onExternalLinkClicked}
            iconClassName="h-[13px] w-[13px]"
          />
        </div>
      }
      footerRightContent={
        loading || pricesLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : stakeBalance !== undefined && !!pricesData?.SKY ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(totalStakedValue, {
              maxDecimals: 2
            })}
          </Text>
        ) : undefined
      }
      url={url}
    />
  );
};
