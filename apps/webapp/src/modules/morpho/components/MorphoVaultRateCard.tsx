import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Text } from '@/modules/layout/components/Typography';
import { useMorphoVaultRate } from '@jetstreamgg/sky-hooks';
// import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';

type MorphoVaultRateCardProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultRateCard({ vaultAddress }: MorphoVaultRateCardProps) {
  const { i18n } = useLingui();
  const { data: rateData, isLoading } = useMorphoVaultRate({ vaultAddress });

  const formattedRate = rateData?.formattedRate || '0.00%';

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Vault Rate`)}
      content={
        <div className="mt-2 flex items-center gap-1.5">
          <Text variant="large" className="text-bullish">
            {formattedRate}
          </Text>
          {/* <PopoverInfo type="morpho-vault" /> */}
        </div>
      }
    />
  );
}
