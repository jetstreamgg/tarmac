import { Intent } from '@/lib/enums';
import { ModuleCard } from '../ModuleCard';
import { t } from '@lingui/core/macro';
import { HStack } from '@/modules/layout/components/HStack';
import { PairTokenIcons, PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Text } from '@/modules/layout/components/Typography';

import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';

export function UpgradeCard() {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

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
        <Text className="text-2xl lg:text-[32px]">
          <span className="text-lg">Delayed Upgrade Penalty starting</span> September 2025
          <PopoverRateInfo type="delayedUpgradePenalty" iconClassName="mt-auto -translate-y-1/4 ml-2" />
        </Text>
      }
    />
  );
}
