import { MorphoVaultRateCard } from './MorphoVaultRateCard';
import { MorphoVaultTvlCard } from './MorphoVaultTvlCard';
import { Token } from '@jetstreamgg/sky-hooks';

type MorphoVaultInfoDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultInfoDetails({ vaultAddress, assetToken }: MorphoVaultInfoDetailsProps) {
  return (
    <div className="flex w-full flex-wrap gap-3">
      <div className="min-w-[250px] flex-1">
        <MorphoVaultRateCard vaultAddress={vaultAddress} />
      </div>
      <div className="min-w-[250px] flex-1">
        <MorphoVaultTvlCard vaultAddress={vaultAddress} assetToken={assetToken} />
      </div>
    </div>
  );
}
