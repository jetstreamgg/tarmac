import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Lock } from './Lock';
import { Borrow } from './Borrow';
import { Trans } from '@lingui/react/macro';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Button } from '@widgets/components/ui/button';
import { Info } from '@widgets/shared/components/icons/Info';

export const UnconnectedState = ({
  onInputAmountChange,
  onShowHelpModal
}: {
  onInputAmountChange: (val: bigint, userTriggered?: boolean) => void;
  onShowHelpModal?: () => void;
}) => {
  return (
    <div className={'mb-8 mt-6 space-y-2'}>
      <HStack className="items-center justify-between">
        <Text>
          <Trans>Open Position</Trans>
        </Text>
        {onShowHelpModal && (
          <Button
            className="text-textSecondary flex h-auto min-h-0 items-center gap-1 p-0"
            onClick={onShowHelpModal}
            variant="link"
          >
            <span className="text-sm">
              <Trans>How to stake</Trans>
            </span>
            <Info />
          </Button>
        )}
      </HStack>
      <VStack gap={2} className="mt-4">
        <Lock isConnectedAndEnabled={false} onChange={onInputAmountChange} />
        <Borrow isConnectedAndEnabled={false} />
      </VStack>
    </div>
  );
};
