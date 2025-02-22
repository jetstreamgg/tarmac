import { Button } from '@/components/ui/button';
import { Longer } from '@/modules/icons/Longer';
import { Simpler } from '@/modules/icons/Simpler';
import { HStack } from '@/modules/layout/components/HStack';
import { Text } from '@/modules/layout/components/Typography';
import { Trans, t } from '@lingui/macro';

type ResponseModifierRow = {
  sendMessage: (message: string) => void;
};

export const ResponseModifierRow = ({ sendMessage }: ResponseModifierRow) => {
  return (
    <HStack className="gap-4 space-x-0">
      <Button variant="link" className="h-fit p-0" onClick={() => sendMessage(t`Please, extend your answer`)}>
        <Longer width={16} height={16} />
        <Text variant="medium" className="ml-1 xl:leading-4">
          <Trans>Longer</Trans>
        </Text>
      </Button>
      <Button
        variant="link"
        className="h-fit p-0"
        onClick={() => sendMessage(t`Please, simplify your answer`)}
      >
        <Simpler width={16} height={16} />
        <Text variant="medium" className="ml-1 xl:leading-4">
          <Trans>Simpler</Trans>
        </Text>
      </Button>
    </HStack>
  );
};
