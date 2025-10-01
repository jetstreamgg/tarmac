import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';
import { Skeleton } from '@/components/ui/skeleton';
import { formatStrAsApy, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useStUsdsData } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';

export function ExpertCard() {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

  const { data: stUsdsData, isLoading: stUsdsDataLoading } = useStUsdsData();
  const moduleRate = stUsdsData?.moduleRate || 0n;
  const formattedRate = moduleRate > 0n ? formatStrAsApy(moduleRate) : '0.00%';

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
        </div>
      }
      emphasisText={
        stUsdsDataLoading && !stUsdsData ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <Text className="text-2xl lg:text-[32px]">
            Rate {formattedRate}
            <PopoverRateInfo type="stusds" iconClassName="mt-auto -translate-y-1/4 ml-2" />
          </Text>
        )
      }
    />
  );
}
