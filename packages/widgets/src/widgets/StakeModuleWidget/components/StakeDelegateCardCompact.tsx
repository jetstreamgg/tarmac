import { positionAnimations } from '@widgets/shared/animation/presets';
import { Text } from '@widgets/shared/components/ui/Typography';
import { MotionHStack } from '@widgets/shared/components/ui/layout/MotionHStack';
import { DelegateInfo } from '@jetstreamgg/sky-hooks';
import { Card } from '@widgets/components/ui/card';
import { cn } from '@widgets/lib/utils';
import { JazziconComponent } from './Jazzicon';
import { getAddress } from 'viem';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { formatBigInt } from '@jetstreamgg/sky-utils';

export const StakeDelegateCardCompact = ({
  delegate,
  urnSelectedVoteDelegate,
  handleCardClick
}: {
  delegate: DelegateInfo;
  urnSelectedVoteDelegate?: `0x${string}`;
  handleCardClick?: (delegateAddress: `0x${string}`) => void;
}) => {
  const isDelegateSelected =
    urnSelectedVoteDelegate && getAddress(delegate.id) === getAddress(urnSelectedVoteDelegate);

  return (
    <Card
      className={cn(
        'flex items-center justify-between bg-radial-(--gradient-position) transition-colors',
        isDelegateSelected
          ? 'from-primary-start/100 to-primary-end/100 cursor-default'
          : 'from-card to-card hover:from-primary-start/40 hover:to-primary-end/40 cursor-pointer'
      )}
      aria-selected={isDelegateSelected}
      onClick={() => {
        if (!isDelegateSelected) {
          handleCardClick?.(delegate.id);
        }
      }}
    >
      <MotionHStack className="items-center gap-3 space-x-0" variants={positionAnimations}>
        <JazziconComponent address={delegate.ownerAddress} diameter={32} className="h-8 w-8" />
        <div className="flex flex-col items-start">
          {delegate.metadata?.name ? (
            <>
              <Text>{delegate.metadata.name}</Text>
              <Text className="text-textSecondary text-sm">
                {delegate.id.slice(0, 6) + '...' + delegate.id.slice(-4)}
              </Text>
            </>
          ) : (
            <Text>{delegate.id.slice(0, 6) + '...' + delegate.id.slice(-4)}</Text>
          )}
        </div>
      </MotionHStack>
      <MotionVStack className="items-end space-y-0" variants={positionAnimations}>
        <Text>{formatBigInt(delegate.totalDelegated, { maxDecimals: 0 })}</Text>
        <Text className="text-textSecondary text-sm leading-4">SKY delegated</Text>
      </MotionVStack>
    </Card>
  );
};
