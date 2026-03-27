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
import { useStUsdsData, useMorphoVaultMultipleRateApiData, MORPHO_VAULTS } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';

export function ExpertCard() {
  const connectedChainId = useChainId();
  const isL2 = isL2ChainId(connectedChainId);

  // stUSDS data
  const { data: stUsdsData, isLoading: stUsdsDataLoading } = useStUsdsData();

  const mainnetChainId = isTestnetId(connectedChainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;

  // Morpho vault rates for all vaults
  const { data: morphoRatesData, isLoading: morphoRatesLoading } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: MORPHO_VAULTS.map(v => v.vaultAddress[mainnetChainId])
  });

  // Calculate highest rate between stUSDS and all Morpho vaults
  const stUsdsRatePercent = stUsdsData?.moduleRate ? calculateApyFromStr(stUsdsData.moduleRate) : 0;
  const morphoMaxRatePercent = (morphoRatesData || []).reduce(
    (max, rate) => Math.max(max, rate.netRate * 100),
    0
  );
  const maxRate = Math.max(stUsdsRatePercent, morphoMaxRatePercent);
  const formattedRate = maxRate > 0 ? `${maxRate.toFixed(2)}%` : '0.00%';

  const isLoading = stUsdsDataLoading || morphoRatesLoading;

  // Deduplicate Morpho vault asset symbols for the subheading labels
  const uniqueMorphoSymbols = [...new Set(MORPHO_VAULTS.map(v => v.assetToken.symbol))];

  return (
    <ModuleCard
      intent={Intent.EXPERT_INTENT}
      module={t`Expert`}
      title={t`Access the stUSDS Rate`}
      className="[background:linear-gradient(90deg,#1a185566_6%,#1a185500_93%),linear-gradient(#EB5EDF,#FFCD6B)]"
      notAvailable={isL2}
      logoName="expert"
      subHeading={
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <HStack gap={2}>
            <PairTokenIcons leftToken="USDS" rightToken="STUSDS" chainId={mainnet.id} />
            <Text className="text-white">With: USDS Get: stUSDS</Text>
          </HStack>
          {uniqueMorphoSymbols.map(symbol => (
            <HStack key={symbol} gap={2}>
              <PairTokenIcons leftToken={symbol} rightToken={symbol} chainId={mainnet.id} />
              <Text className="text-white">
                With: {symbol} Get: {symbol}
              </Text>
            </HStack>
          ))}
        </div>
      }
      emphasisText={
        isLoading && !stUsdsData && !morphoRatesData ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rate: {formattedRate}
            <PopoverRateInfo type="stusds" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
    />
  );
}
