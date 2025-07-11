import { Button } from '@/components/ui/button';
import { ChatbotSend } from '@/modules/icons';
import { HStack } from '@/modules/layout/components/HStack';
import { useState, useRef } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useChatContext } from '../context/ChatContext';
import { Text } from '@/modules/layout/components/Typography';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FeedbackModal } from './FeedbackModal';

export const ChatInput = ({ sendMessage }: { sendMessage: (message: string) => void }) => {
  const [inputText, setInputText] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { isLoading, chatHistory } = useChatContext();
  const isMessageSendingBlocked = !inputText || isLoading;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFeedbackClick = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = (topics: string[]) => {
    const formattedTopics = topics.join(',');
    const fullText = `/feedback ${formattedTopics} - [elaborate your feedback]`;
    setInputText(fullText);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (isMessageSendingBlocked) return;
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

  const isFirstMessage = chatHistory.length === 1;
  const placeholder = isFirstMessage ? t`Ask me anything` : t`Ask another question`;

  return (
    <>
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
      />
      <div>
        <HStack className="bg-card justify-between rounded-xl p-4 hover:brightness-125">
          <input
            ref={inputRef}
            placeholder={placeholder}
            className="ring-offset-background min-w-0 grow bg-transparent text-sm leading-4 text-white placeholder:text-violet-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:placeholder:text-violet-200/20"
            value={inputText}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={e => setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyUp={handleKeyPress}
          />
          <HStack className="@sm/chat:gap-2 shrink-0 gap-1">
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="@sm/chat:px-2 h-6 rounded-lg border border-violet-200/30 bg-transparent px-1 text-xs text-violet-200/70 hover:border-violet-200/50 hover:bg-transparent hover:text-white active:bg-transparent"
                  onClick={handleFeedbackClick}
                >
                  <Text variant="small" className="@sm/chat:inline hidden">
                    <Trans>Feedback</Trans>
                  </Text>
                  <Text variant="small" className="@sm/chat:hidden">
                    <Trans>FB</Trans>
                  </Text>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="@sm/chat:max-w-xs max-w-[180px]">
                <Text variant="small" className="@sm/chat:hidden">
                  <Trans>Click to share feedback about this chat</Trans>
                </Text>
                <Text variant="small" className="@sm/chat:inline hidden">
                  <Trans>
                    Share your feedback about this chat experience. Click this button to start a feedback
                    message, then type your thoughts and send.
                  </Trans>
                </Text>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              className="h-6 bg-transparent p-0 text-white hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:text-violet-200/50"
              disabled={isMessageSendingBlocked}
              onClick={handleSubmit}
            >
              <ChatbotSend />
            </Button>
          </HStack>
        </HStack>
        <Text className="ml-1 mt-1 text-[8px] text-violet-200/50">
          {inputText.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      </div>
    </>
  );
};
