import { formatBigInt, formatStrAsApy } from '@jetstreamgg/sky-utils';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useStUsdsData, useStUsdsCapacityData } from '@jetstreamgg/sky-hooks';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type StusdsStatsCardProps = {
  onClick?: () => void;
  disabled?: boolean;
};

export const StusdsStatsCard = ({ onClick, disabled = false }: StusdsStatsCardProps) => {
  const { i18n } = useLingui();

  // Hooks for stUSDS data
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: capacityData, isLoading: capacityLoading } = useStUsdsCapacityData();

  // Data handling
  const moduleRate = stUsdsData?.moduleRate || 0n;
  const formattedRate = moduleRate > 0n ? formatStrAsApy(moduleRate) : '0.00%';
  const utilizationRate = capacityData?.utilizationRate ?? 0;
  const totalAssets = stUsdsData?.totalAssets || 0n;

  return (
    <Card
      className={`from-card to-card h-full bg-radial-(--gradient-position) transition-[background-color,background-image,opacity] lg:p-5 ${onClick && !disabled ? 'hover:from-primary-start/100 hover:to-primary-end/100 cursor-pointer' : ''} ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid="stusds-stats-card"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        {/* Left side - Title */}
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-6 w-6" token={{ symbol: 'stUSDS' }} />
          <Text>stUSDS</Text>
        </HStack>

        {/* Right side - Rate */}
        <HStack className="items-center" gap={2}>
          {stUsdsLoading ? (
            <Skeleton className="bg-textSecondary h-6 w-16" />
          ) : (
            <>
              <Text className="text-primary">
                <Text tag="span" className="text-bullish ml-1">
                  {formattedRate}
                </Text>
              </Text>
              <PopoverRateInfo type="stusds" width={12} height={12} />
            </>
          )}
        </HStack>
      </CardHeader>

      <CardContent className="mt-5 p-0">
        <HStack className="justify-between" gap={2}>
          {/* Utilization */}
          <VStack className="justify-between" gap={2} data-testid="utilization-container">
            <Text className="text-textSecondary text-sm leading-4">{i18n._(msg`Utilization`)}</Text>
            {capacityLoading ? (
              <Skeleton className="bg-textSecondary h-6 w-10" />
            ) : (
              <Text dataTestId="stusds-utilization">{utilizationRate.toFixed(1)}%</Text>
            )}
          </VStack>

          {/* TVL */}
          <VStack className="items-stretch justify-between text-right" gap={2} data-testid="tvl-container">
            <Text className="text-textSecondary text-sm leading-4">{i18n._(msg`TVL`)}</Text>
            {stUsdsLoading ? (
              <div className="flex justify-end">
                <Skeleton className="bg-textSecondary h-6 w-10" />
              </div>
            ) : (
              <Text dataTestId="stusds-tvl">
                {formatBigInt(totalAssets, { unit: 18, compact: true })} USDS
              </Text>
            )}
          </VStack>
        </HStack>
      </CardContent>
    </Card>
  );
};
