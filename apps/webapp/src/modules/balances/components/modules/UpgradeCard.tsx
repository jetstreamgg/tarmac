import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';

import { isL2ChainId, math } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';
import { useMkrSkyFee } from '@jetstreamgg/sky-hooks';
import { Skeleton } from '@/components/ui/skeleton';

export function UpgradeCard() {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

  const { data: mkrSkyFee, isLoading: isFeeLoading, error: feeError } = useMkrSkyFee();

  // Only calculate the penalty when we have a fee value and no loading errors
  const upgradePenalty =
    !feeError && mkrSkyFee !== undefined ? math.calculateUpgradePenalty(mkrSkyFee) : undefined;

  return (
    <ModuleCard
      intent={Intent.UPGRADE_INTENT}
      module={t`Upgrade`}
      title={t`Upgrade your DAI and MKR`}
      className="from-[#2a1679] to-[#794dba]"
      notAvailable={isL2}
      logoName="upgrade"
      subHeading={
        <div className="flex flex-wrap gap-2 lg:gap-4">
          <HStack gap={2}>
            <PairTokenIcons leftToken="DAI" rightToken="USDS" chainId={mainnet.id} />
            <Text className="text-textSecondary">DAI to USDS</Text>
          </HStack>
          <HStack gap={2}>
            <PairTokenIcons leftToken="MKR" rightToken="SKY" chainId={mainnet.id} />
            <Text className="text-textSecondary">MKR to SKY</Text>
          </HStack>
        </div>
      }
      emphasisText={
        isFeeLoading ? (
          <Skeleton className="h-12 w-80" />
        ) : feeError ? (
          <></>
        ) : upgradePenalty !== undefined ? (
          <Text className="text-2xl lg:text-[32px]">
            <span className="text-lg">
              Delayed Upgrade Penalty
              <PopoverRateInfo type="delayedUpgradePenalty" iconClassName="  ml-1" />:
            </span>{' '}
            {upgradePenalty}%
          </Text>
        ) : (
          <></>
        )
      }
    />
  );
}
