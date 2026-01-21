import { Button } from '@/components/ui/button';
import { ChatbotSend } from '@/modules/icons';
import { HStack } from '@/modules/layout/components/HStack';
import { useState, useRef, useEffect } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useChatContext } from '../context/ChatContext';
import { Text } from '@/modules/layout/components/Typography';
import { MAX_MESSAGE_LENGTH, CHATBOT_FEEDBACK_ENABLED } from '@/lib/constants';
import { MessageType } from '../constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FeedbackModal } from './FeedbackModal';

export const ChatInput = ({ sendMessage }: { sendMessage: (message: string) => void }) => {
  const [inputText, setInputText] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { isLoading, chatHistory, termsAccepted, isRestricted } = useChatContext();
  const isAuthError = chatHistory.at(-1)?.type === MessageType.authError && !termsAccepted;
  const isMessageSendingBlocked = !inputText.trim() || isLoading || isAuthError || isRestricted;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleFeedbackClick = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = (topics: string[], message: string) => {
    const formattedTopics = topics.join(',');
    const fullText = `/feedback ${formattedTopics} - ${message}`;
    sendMessage(fullText);
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSubmit = () => {
    if (isMessageSendingBlocked) return;
    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }
    sendMessage(trimmed);
    setInputText('');
  };

  // Support for sending messages with the enter key
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (inputText) {
        handleSubmit();
      }
      return;
    }
  };

  const isFirstMessage = chatHistory.length === 1;
  const placeholder = isRestricted
    ? t`Chat is not available in your jurisdiction`
    : isAuthError
      ? t`Please accept the terms of service to continue`
      : isFirstMessage
        ? t`Ask me about Sky`
        : t`Ask another question`;

  return (
    <>
      {CHATBOT_FEEDBACK_ENABLED && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
        />
      )}
      <div>
        <HStack className="bg-card items-end justify-between rounded-xl p-4 hover:brightness-125">
          <textarea
            ref={inputRef}
            placeholder={placeholder}
            className="ring-offset-background scrollbar-thin max-h-[120px] min-h-[20px] min-w-0 grow resize-none overflow-y-auto bg-transparent text-sm leading-5 text-white placeholder:text-violet-200/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none focus-visible:placeholder:text-violet-200/20"
            value={inputText}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={e => setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyPress}
            rows={1}
            disabled={isAuthError || isRestricted}
          />
          <HStack className="shrink-0 gap-1 @sm/chat:gap-2">
            {CHATBOT_FEEDBACK_ENABLED && (
              <div className={`${inputText.trim().length > 0 ? 'hidden @sm/chat:block' : 'block'}`}>
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-6 rounded-lg border border-violet-200/30 bg-transparent px-1 text-xs text-violet-200/70 transition-opacity duration-200 hover:border-violet-200/50 hover:bg-transparent hover:text-white active:bg-transparent disabled:border-violet-200/20 disabled:text-violet-200/40 disabled:hover:border-violet-200/20 disabled:hover:text-violet-200/40 @sm/chat:px-2"
                      onClick={handleFeedbackClick}
                      disabled={isLoading || isAuthError || isRestricted}
                    >
                      <Text variant="small" className="hidden @sm/chat:inline">
                        <Trans>Feedback</Trans>
                      </Text>
                      <Text variant="small" className="@sm/chat:hidden">
                        <Trans>FB</Trans>
                      </Text>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[180px] @sm/chat:max-w-xs">
                    <Text variant="small" className="@sm/chat:hidden">
                      <Trans>Click to share feedback about this chat</Trans>
                    </Text>
                    <Text variant="small" className="hidden @sm/chat:inline">
                      <Trans>
                        Share your feedback about this chat experience. Click this button to start a feedback
                        message, then type your thoughts and send.
                      </Trans>
                    </Text>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
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
        <Text className="mt-1 ml-1 text-[8px] text-violet-200/50">
          {inputText.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      </div>
    </>
  );
};
