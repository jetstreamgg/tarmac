import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { Lock } from './Lock';
import { Borrow } from './Borrow';
import { Free } from './Free';
import { Repay } from './Repay';
import { Trans } from '@lingui/react/macro';

export const UnconnectedState = ({
  onInputAmountChange
}: {
  onInputAmountChange?: (val: bigint, userTriggered?: boolean) => void;
}) => {
  return (
    <div className="mb-8 mt-6 space-y-2">
      <Tabs defaultValue="left">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger position="left" value="left">
            <Trans>Seal and borrow</Trans>
          </TabsTrigger>
          <TabsTrigger position="right" value="right">
            <Trans>Unseal and pay back</Trans>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="left">
          <VStack gap={2} className="mt-4">
            <Lock isConnectedAndEnabled={false} onChange={onInputAmountChange} />
            <Borrow isConnectedAndEnabled={false} />
          </VStack>
        </TabsContent>
        <TabsContent value="right">
          <VStack gap={2} className="mt-4">
            <Free isConnectedAndEnabled={false} sealedAmount={0n} onChange={onInputAmountChange} />
            <Repay isConnectedAndEnabled={false} />
          </VStack>
        </TabsContent>
      </Tabs>
    </div>
  );
};
