import { useStUsdsData, usePrices } from '@jetstreamgg/sky-hooks';
import { formatBigInt, formatNumber, formatStrAsApy } from '@jetstreamgg/sky-utils';
import { Text } from '@widgets/shared/components/ui/Typography';
import { t } from '@lingui/core/macro';
import { InteractiveStatsCard } from '@widgets/shared/components/ui/card/InteractiveStatsCard';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { formatUnits } from 'viem';
import { CardProps, ModuleCardVariant } from './ModulesBalances';
import { RateLineWithArrow } from '@widgets/shared/components/ui/RateLineWithArrow';
import { InteractiveStatsCardAlt } from '@widgets/shared/components/ui/card/InteractiveStatsCardAlt';

export const StUSDSBalanceCard = ({
  url,
  onExternalLinkClicked,
  loading,
  variant = ModuleCardVariant.default
}: CardProps) => {
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const userSuppliedUsds = stUsdsData?.userSuppliedUsds || 0n;
  const moduleRate = stUsdsData?.moduleRate || 0n;

  return variant === ModuleCardVariant.default ? (
    <InteractiveStatsCard
      title={t`USDS supplied to stUSDS`}
      tokenSymbol="stUSDS"
      headerRightContent={
        loading || stUsdsLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(userSuppliedUsds)}</Text>
        )
      }
      footer={
        stUsdsLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : moduleRate > 0n ? (
          <RateLineWithArrow
            rateText={`Rate: ${formatStrAsApy(moduleRate)}`}
            popoverType="stusds"
            onExternalLinkClicked={onExternalLinkClicked}
          />
        ) : (
          <></>
        )
      }
      footerRightContent={
        loading || pricesLoading || stUsdsLoading ? (
          <Skeleton className="h-[13px] w-20" />
        ) : userSuppliedUsds > 0n && !!pricesData?.USDS ? (
          <Text variant="small" className="text-textSecondary">
            $
            {formatNumber(parseFloat(formatUnits(userSuppliedUsds, 18)) * parseFloat(pricesData.USDS.price), {
              maxDecimals: 2
            })}
          </Text>
        ) : undefined
      }
      url={url}
    />
  ) : (
    <InteractiveStatsCardAlt
      title={t`USDS supplied to stUSDS`}
      tokenSymbol="stUSDS"
      url={url}
      logoName="expert"
      content={
        loading || stUsdsLoading ? (
          <Skeleton className="w-32" />
        ) : (
          <Text>{formatBigInt(userSuppliedUsds)} USDS</Text>
        )
      }
    />
  );
};
