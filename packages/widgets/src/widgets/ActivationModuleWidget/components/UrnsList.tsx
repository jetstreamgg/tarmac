import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { useCurrentUrnIndex } from '@jetstreamgg/hooks';
import { UrnPosition } from './UrnPosition';
import { Heading } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { OnActivationUrnChange } from '..';

export const UrnsList = ({
  claimPrepared,
  claimExecute,
  onActivationUrnChange
}: {
  claimPrepared: boolean;
  claimExecute: () => void;
  onActivationUrnChange?: OnActivationUrnChange;
}) => {
  const { data: currentIndex } = useCurrentUrnIndex();
  const amountOfUrns = Array.from(Array(Number(currentIndex || 0n)).keys());
  if (!currentIndex) return null;

  return (
    <VStack gap={6}>
      <Heading tag="h3" variant="small" className="leading-6">
        <div className="flex items-center">
          <Trans>Your positions</Trans>
        </div>
      </Heading>
      <div className="h-1/2 overflow-auto">
        <div className="flex flex-col gap-6">
          {amountOfUrns.map(index => (
            <UrnPosition
              key={index}
              index={BigInt(index)}
              claimPrepared={claimPrepared}
              claimExecute={claimExecute}
              onActivationUrnChange={onActivationUrnChange}
            />
          ))}
        </div>
      </div>
    </VStack>
  );
};
