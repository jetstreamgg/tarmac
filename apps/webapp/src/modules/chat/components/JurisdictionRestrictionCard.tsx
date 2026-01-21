import { Card } from '@/components/ui/card';
import { VStack } from '@/modules/layout/components/VStack';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { ForbidenLocation } from '@/modules/icons/ForbidenLocation';

export const JurisdictionRestrictionCard = () => {
  return (
    <Card className="mx-auto max-w-md p-8">
      <VStack className="items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <ForbidenLocation className="h-8 w-8 text-red-400" />
        </div>
        <VStack className="gap-3">
          <Text className="text-xl font-medium text-white">
            <Trans>Chatbot not available in your region</Trans>
          </Text>
          <Text className="text-textSecondary">
            <Trans>Access to the chatbot is restricted in certain jurisdictions.</Trans>
          </Text>
        </VStack>
      </VStack>
    </Card>
  );
};
