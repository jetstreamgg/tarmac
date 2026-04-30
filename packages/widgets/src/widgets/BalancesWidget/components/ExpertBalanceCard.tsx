import { useStUsdsData, usePrices } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatNumber, calculateApyFromStr } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';

export const ExpertBalanceCard = ({
  url,
  onExternalLinkClicked,
  loading,
  variant = ModuleCardVariant.default
}: CardProps) => {
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Expert supplied funds = total across expert modules (stUSDS only for now)
  const stUsdsSupplied = stUsdsData?.userSuppliedUsds || 0n;
  const stUsdsRate = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;

  const isBalanceLoading = stUsdsLoading;
  const isRateLoading = loading || stUsdsLoading;

  const expertIcon = <img src="/images/expert_icon_large.svg" alt="Expert" className="h-full w-full" />;

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`Supplied to Expert`}
      icon={expertIcon}
      headerRightContent={
        loading || isBalanceLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(stUsdsSupplied)}</Text>
        )
      }
      footer={
        isRateLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : stUsdsRate > 0 ? (
          <RateLineWithArrow
            rateText={t`Rate: ${stUsdsRate.toFixed(2)}%`}
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
        ) : stUsdsSupplied > 0n && !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(parseFloat(formatUnits(stUsdsSupplied, 18)) * parseFloat(pricesData.USDS.price), {
              maxDecimals: 2
            })}
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
          <Text>{formatBigInt(stUsdsSupplied)} USDS</Text>
        )
      }
    />
  );
};
