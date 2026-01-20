import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useMorphoVaultRate, MorphoVaultRateData } from '@jetstreamgg/sky-hooks';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExternalLink, Sparkles, BarChart3, DollarSign, Info } from 'lucide-react';

type MorphoVaultRateCardProps = {
  vaultAddress: `0x${string}`;
};

function RateBreakdownTooltip({ rateData }: { rateData: MorphoVaultRateData }) {
  return (
    <div className="flex min-w-[220px] flex-col gap-2 p-1">
      {/* Native APY */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-textSecondary h-4 w-4" />
          <Text className="text-textSecondary text-sm">
            <Trans>Native APY</Trans>
          </Text>
        </div>
        <Text className="text-text text-sm">{rateData.formattedRate}</Text>
      </div>

      {/* Rewards */}
      {rateData.rewards.length > 0 &&
        rateData.rewards.map(reward => (
          <div key={reward.symbol} className="flex items-center justify-between gap-4">
            <a
              href="https://app.morpho.org/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 transition-opacity hover:opacity-70"
              onClick={e => e.stopPropagation()}
            >
              <TokenIcon token={{ symbol: reward.symbol }} className="h-4 w-4" />
              <Text className="text-textSecondary text-sm">{reward.symbol}</Text>
              <ExternalLink className="text-textSecondary h-3 w-3" />
            </a>
            <Text className="text-bullish text-sm">{reward.formattedApy}</Text>
          </div>
        ))}

      {/* Performance Fee */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DollarSign className="text-textSecondary h-4 w-4" />
          <Text className="text-textSecondary text-sm">
            <Trans>Performance Fee</Trans>
          </Text>
          <span className="bg-cardSecondary text-textSecondary rounded px-1.5 py-0.5 text-xs">
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DollarSign className="text-textSecondary h-4 w-4" />
          <Text className="text-textSecondary text-sm">
            <Trans>Management Fee</Trans>
          </Text>
          <span className="bg-cardSecondary text-textSecondary rounded px-1.5 py-0.5 text-xs">
            {rateData.formattedManagementFee}
          </span>
        </div>
        <Text className="text-text text-sm">
          {rateData.managementFee ? `-${(rateData.managementFee * 100).toFixed(2)}%` : '0.00%'}
        </Text>
      </div>

      {/* Divider */}
      <div className="border-cardSecondary my-1 border-t" />

      {/* Net APY */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-bullish h-4 w-4" />
          <Text className="text-bullish text-sm font-medium">
            <Trans>Net APY</Trans>
          </Text>
        </div>
        <Text className="text-bullish text-sm font-medium">={rateData.formattedNetRate}</Text>
      </div>
    </div>
  );
}

export function MorphoVaultRateCard({ vaultAddress }: MorphoVaultRateCardProps) {
  const { i18n } = useLingui();
  const { data: rateData, isLoading } = useMorphoVaultRate({ vaultAddress });

  const formattedNetRate = rateData?.formattedNetRate || '0.00%';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Vault Rate`)}
      content={
        <div className="mt-2 flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger className="cursor-pointer">
              <div className="flex items-center gap-2">
                <Text variant="large" className="text-bullish">
                  {formattedNetRate}
                </Text>
                <Info className="text-textSecondary h-4 w-4" />
              </div>
            </PopoverTrigger>
            {rateData && (
              <PopoverContent side="bottom" align="start" className="w-auto backdrop-blur-[50px]">
                <RateBreakdownTooltip rateData={rateData} />
              </PopoverContent>
            )}
          </Popover>
        </div>
      }
    />
  );
}
