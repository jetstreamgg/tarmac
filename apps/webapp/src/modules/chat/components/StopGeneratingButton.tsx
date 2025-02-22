import { Button } from '@/components/ui/button';
import { MessageType } from '../constants';
import { useChatContext } from '../context/ChatContext';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/macro';
import { Stop } from '@/modules/icons/Stop';

export const StopGeneratingButton = () => {
  const { setChatHistory } = useChatContext();

  const handleStopGenerating = () => {
    // Set the last two messages as canceled: the user and the bot messages respectively
    // so we don't send them in the history on the next request
    setChatHistory(prev => [
      ...prev.slice(0, -2),
      {
        ...prev[prev.length - 2],
        type: MessageType.canceled
      },
      {
        ...prev[prev.length - 1],
        message: '',
        type: MessageType.canceled
      }
    ]);
  };

  return (
    <Button variant="link" className="h-fit p-0" onClick={handleStopGenerating}>
      <Stop width={16} height={16} />
      <Text variant="medium" className="ml-1 xl:leading-4">
        <Trans>Stop generating</Trans>
      </Text>
    </Button>
  );
};
