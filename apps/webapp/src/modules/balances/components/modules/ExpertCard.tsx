import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';
import { Skeleton } from '@/components/ui/skeleton';
import {
  isL2ChainId,
  calculateApyFromStr,
  chainId as chainIdConstants,
  isTestnetId
} from '@jetstreamgg/sky-utils';
import { useStUsdsData, useMorphoVaultRate, MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';

export function ExpertCard() {
  const connectedChainId = useChainId();
  const isL2 = isL2ChainId(connectedChainId);
  const mainnetChainId = isTestnetId(connectedChainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;

  // stUSDS data
  const { data: stUsdsData, isLoading: stUsdsDataLoading } = useStUsdsData();

  // Morpho vault data
  const defaultMorphoVault = MORPHO_VAULTS[0];
  const morphoVaultAddress = defaultMorphoVault?.vaultAddress[mainnetChainId];
  const { data: morphoRateData, isLoading: morphoRateLoading } = useMorphoVaultRate({
    vaultAddress: morphoVaultAddress
  });

  // Calculate highest rate between stUSDS and Morpho
  const stUsdsRatePercent = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;
  const morphoRatePercent = morphoRateData?.netRate ? morphoRateData.netRate * 100 : 0;
  const maxRate = Math.max(stUsdsRatePercent, morphoRatePercent);
  const formattedRate = maxRate > 0 ? `${maxRate.toFixed(2)}%` : '0.00%';

  const isLoading = stUsdsDataLoading || morphoRateLoading;

  return (
    <ModuleCard
      intent={Intent.EXPERT_INTENT}
      module={t`Expert`}
      title={t`Access the stUSDS and Morpho Vault Rate`}
      className="[background:linear-gradient(90deg,#1a185566_6%,#1a185500_93%),linear-gradient(#EB5EDF,#FFCD6B)]"
      notAvailable={isL2}
      logoName="expert"
      subHeading={
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <HStack gap={2}>
            <PairTokenIcons leftToken="USDS" rightToken="STUSDS" chainId={mainnet.id} />
            <Text className="text-white">With: USDS Get: stUSDS</Text>
          </HStack>
          <HStack gap={2}>
            <PairTokenIcons leftToken="USDS" rightToken="USDS" chainId={mainnet.id} />
            <Text className="text-white">With: USDS Get: USDS</Text>
          </HStack>
        </div>
      }
      emphasisText={
        isLoading && !stUsdsData && !morphoRateData ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rates up to {formattedRate}
            <PopoverRateInfo type="expert" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
    />
  );
}
