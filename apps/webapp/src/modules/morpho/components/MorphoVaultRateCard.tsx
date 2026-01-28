import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useMorphoVaultRate } from '@jetstreamgg/sky-hooks';
import { MorphoRateBreakdownPopover } from '@jetstreamgg/sky-widgets';

type MorphoVaultRateCardProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultRateCard({ vaultAddress }: MorphoVaultRateCardProps) {
  const { i18n } = useLingui();
  const { isLoading } = useMorphoVaultRate({ vaultAddress });

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Vault Rate`)}
      content={
        <div className="mt-2 flex items-center gap-1.5">
          <MorphoRateBreakdownPopover vaultAddress={vaultAddress} />
        </div>
      }
    />
  );
}
