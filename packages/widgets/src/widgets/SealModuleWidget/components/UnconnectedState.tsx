import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Free } from './Free';
import { Repay } from './Repay';

export const UnconnectedState = ({
  onInputAmountChange
}: {
  onInputAmountChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  return (
    <div className="mb-8 mt-6 space-y-2">
      <VStack gap={2} className="mt-4">
        <Free isConnectedAndEnabled={false} sealedAmount={0n} onChange={onInputAmountChange} />
        <Repay isConnectedAndEnabled={false} />
      </VStack>
    </div>
  );
};
