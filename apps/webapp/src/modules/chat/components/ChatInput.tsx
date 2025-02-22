import { Button } from '@/components/ui/button';
import { ChatbotSend } from '@/modules/icons';
import { HStack } from '@/modules/layout/components/HStack';
import { useState } from 'react';
import { t } from '@lingui/macro';
import { useChatContext } from '../context/ChatContext';

export const ChatInput = ({ sendMessage }: { sendMessage: (message: string) => void }) => {
  const [inputText, setInputText] = useState('');
  const { isLoading } = useChatContext();

  const handleSubmit = () => {
    console.log('handleSubmit', inputText);
    sendMessage(inputText);
    setInputText('');
  };

  // Support for sending messages with the enter key
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputText) {
      handleSubmit();
      return;
    }
  };

  return (
    <HStack className="bg-card justify-between rounded-xl p-4 hover:brightness-125">
      <input
        placeholder={t`Ask another question`}
        className="ring-offset-background grow bg-transparent text-sm leading-4 text-white placeholder:text-violet-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:placeholder:text-violet-200/20"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        onKeyUp={handleKeyPress}
      />
      <Button
        variant="ghost"
        className="h-6 bg-transparent p-0 text-white hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:text-violet-200/50"
        disabled={!inputText || isLoading}
        onClick={handleSubmit}
      >
        <ChatbotSend />
      </Button>
    </HStack>
  );
};
