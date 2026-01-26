import { Popover, PopoverContent, PopoverTrigger } from '@widgets/components/ui/popover';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { BarChart } from '@widgets/shared/components/icons/BarChart';
import { ChartPaper } from '@widgets/shared/components/icons/ChartPaper';
import { TextPaper } from '@widgets/shared/components/icons/TextPaper';
import { Sparkles } from '@widgets/shared/components/icons/Sparkles';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { useMorphoVaultRate } from '@jetstreamgg/sky-hooks';
import { Trans } from '@lingui/react/macro';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';

export function MorphoRateBreakdownPopover({
  vaultAddress,
  tooltipIconClassName
}: {
  vaultAddress: `0x${string}`;
  tooltipIconClassName?: string;
}) {
  const { data: rateData, isLoading } = useMorphoVaultRate({ vaultAddress });
  const formattedNetRate = rateData?.formattedNetRate || '0.00%';

  if (!rateData) return null;
  if (isLoading) return <Skeleton className="h-6 w-20" />;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild className="cursor-pointer" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Sparkles className="text-bullish h-4 w-4" />
            <Text variant="large" className="text-bullish">
              {formattedNetRate}
            </Text>
          </div>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-auto backdrop-blur-[50px]">
          <div className="flex min-w-[220px] flex-col gap-2 p-1">
            {/* Native Rate */}
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <BarChart className="text-textSecondary h-4 w-4" />
                <Text className="text-textSecondary text-sm">
                  <Trans>Native Rate</Trans>
                </Text>
              </div>
              <Text className="text-text text-sm">{rateData.formattedRate}</Text>
            </div>

            {/* Rewards */}
            {rateData.rewards.length > 0 &&
              rateData.rewards.map(reward => (
                <div key={reward.symbol} className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <TokenIcon token={{ symbol: reward.symbol }} className="h-4 w-4" />
                    <Text className="text-textSecondary text-sm">{reward.symbol} incentive</Text>
                  </div>
                  <Text className="text-bullish text-sm">{reward.formattedApy}</Text>
                </div>
              ))}

            {/* Performance Fee */}
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <ChartPaper className="text-textSecondary h-4 w-4" />
                <Text className="text-textSecondary text-sm">
                  <Trans>Performance Fee</Trans>
                </Text>
                <span className="bg-textSecondary/15 text-textSecondary rounded px-1.5 py-0.5 text-xs">
                  {rateData.formattedPerformanceFee}
                </span>
              </div>
              <Text className="text-text text-sm">
                {rateData.performanceFee
                  ? `-${(rateData.rate * rateData.performanceFee * 100).toFixed(2)}%`
                  : '0.00%'}
              </Text>
            </div>

            {/* Management Fee */}
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <TextPaper className="text-textSecondary h-4 w-4" />
                <Text className="text-textSecondary text-sm">
                  <Trans>Management Fee</Trans>
                </Text>
                <span className="bg-textSecondary/15 text-textSecondary rounded px-1.5 py-0.5 text-xs">
                  {rateData.formattedManagementFee}
                </span>
              </div>
              <Text className="text-text text-sm">
                {rateData.managementFee ? `-${(rateData.managementFee * 100).toFixed(2)}%` : '0.00%'}
              </Text>
            </div>

            {/* Divider */}
            <div className="border-cardSecondary my-1 border-t" />

            {/* Net Rate */}
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <Sparkles className="text-bullish h-4 w-4" />
                <Text className="text-bullish text-sm font-medium">
                  <Trans>Net Rate</Trans>
                </Text>
              </div>
              <Text className="text-bullish text-sm font-medium">={rateData.formattedNetRate}</Text>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <PopoverRateInfo type="morpho" iconClassName={tooltipIconClassName} />
    </div>
  );
}
