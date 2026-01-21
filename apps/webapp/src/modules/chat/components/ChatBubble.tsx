import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { MessageType, UserType } from '../constants';
import { Text } from '@/modules/layout/components/Typography';
import { useConnection } from 'wagmi';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useSearchParams } from 'react-router-dom';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { CHAT_SUGGESTIONS_ENABLED, QueryParams } from '@/lib/constants';
import { motion } from 'framer-motion';
import { ResponseModifierRow } from './ResponseModifierRow';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ChatIntent } from '../types/Chat';
import { ChatIntentsRow } from './ChatIntentsRow';
import { StopGeneratingButton } from './StopGeneratingButton';
import { ChatError } from '@/modules/icons';
import { ChatMarkdownRenderer } from '@/modules/ui/components/markdown/ChatMarkdownRenderer';
import { useChatContext } from '../context/ChatContext';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMemo } from 'react';

type ChatBubbleProps = {
  user: UserType;
  message: string;
  type?: MessageType;
  isLastMessage?: boolean;
  isFirstMessage?: boolean;
  isOnlyMessage?: boolean;
  intents?: ChatIntent[];
  sendMessage: (message: string) => void;
  showModifierRow?: boolean;
};

// Default suggested questions if env var is not set
const DEFAULT_SUGGESTED_QUESTIONS = [
  'What is Sky Protocol?',
  'How can I get USDS?',
  'What can I do with USDS?'
];

const TypingIndicator: React.FC<{ text?: string }> = ({ text = '' }) => {
  const dotVariants = {
    start: { y: '0%' },
    animate: { y: ['0%', '-120%', '0%'] }
  };

  const transition = {
    duration: '0.8',
    repeat: Infinity,
    repeatType: 'loop' as const,
    repeatDelay: 0.3,
    ease: 'easeInOut'
  };

  const dotClasses = 'mx-[2px] mb-[5px] h-[5px] w-[5px] rounded-full bg-white/75';

  return (
    <HStack gap={2} className="items-end">
      {text && <Text className="text-white/75">{text}</Text>}
      <div className="mt-3 flex items-center">
        {[0.1, 0.2, 0.3].map((delay, index) => (
          <motion.div
            key={index}
            className={dotClasses}
            variants={dotVariants}
            animate="animate"
            transition={{ ...transition, delay }}
          />
        ))}
      </div>
    </HStack>
  );
};

export const ChatBubble = ({
  user,
  message,
  type,
  intents,
  sendMessage,
  showModifierRow = true,
  isLastMessage,
  isOnlyMessage
}: ChatBubbleProps) => {
  const { address } = useConnection();
  const [searchParams] = useSearchParams();
  const { bpi } = useBreakpointIndex();
  const { setShowTermsModal, termsAccepted } = useChatContext();
  const shouldUseLargeAvatar = bpi >= BP.xl && searchParams.get(QueryParams.Details) !== 'true';
  const isError = type === MessageType.error;
  const isLoading = type === MessageType.loading;
  const isInternal = type === MessageType.internal;
  const isCanceled = type === MessageType.canceled;
  const isAuthError = type === MessageType.authError;
  const isFeedback = message.startsWith('/feedback');

  // Parse suggested questions from environment variable
  const suggestedQuestions = useMemo(() => {
    const envQuestions = import.meta.env.VITE_CHATBOT_SUGGESTED_QUESTIONS;
    if (envQuestions) {
      try {
        // Support both JSON array format and comma-separated format
        if (envQuestions.startsWith('[')) {
          return JSON.parse(envQuestions);
        } else {
          return envQuestions
            .split(',')
            .map((q: string) => q.trim())
            .filter(Boolean);
        }
      } catch (e) {
        console.warn('Failed to parse VITE_CHATBOT_SUGGESTED_QUESTIONS:', e);
        return DEFAULT_SUGGESTED_QUESTIONS;
      }
    }
    return DEFAULT_SUGGESTED_QUESTIONS;
  }, []);

  const handleQuestionClick = (question: string) => {
    sendMessage(question);
  };

  // Parse feedback message to extract the actual feedback content
  const getFeedbackContent = () => {
    if (!isFeedback) return null;
    // Format: /feedback topics - message
    // Make the regex more flexible with whitespace
    const match = message.match(/^\/feedback\s+(.+?)\s*-\s*(.+)$/s);
    if (match) {
      return {
        topics: match[1].split(',').map(t => t.trim()),
        message: match[2].trim()
      };
    }
    return null;
  };

  if (user === UserType.user && isCanceled) {
    return null;
  }

  return (
    <div
      // The `@2xl/chat` class is used to style elements based on the width of the `@container/chat` container
      className={`flex flex-col gap-3 xl:gap-2 @2xl/chat:items-start ${user === UserType.user ? '@2xl/chat:flex-row-reverse' : 'xl:@2xl/chat:gap-0'}`}
    >
      <HStack
        className={`items-center gap-x-2 space-x-0 ${user === UserType.user ? 'xl:self-end xl:@2xl/chat:self-start' : '@2xl/chat:items-start'}`}
      >
        {user === UserType.bot ? (
          // <img
          //   src="/images/chatbot_logo.svg"
          //   alt={`${CHATBOT_NAME} avatar`}
          //   className="@2xl/chat:h-8 @2xl/chat:w-8 h-5 w-5"
          // />
          <></>
        ) : (
          <CustomAvatar address={address || 'address-not-connected'} size={shouldUseLargeAvatar ? 32 : 20} />
        )}
        <Text
          variant="medium"
          className={`text-textSecondary block leading-4 ${user === UserType.user ? 'xl:hidden' : ''}`}
        >
          {user}
        </Text>
      </HStack>
      <VStack
        className={`gap-2 ${user === UserType.user ? 'xl:from-primary-start/100 xl:to-primary-end/100 xl:w-fit xl:max-w-full xl:min-w-0 xl:self-end xl:rounded-2xl xl:rounded-tr-[2px] xl:bg-radial-(--gradient-position) xl:py-3 xl:pr-7 xl:pb-0 xl:pl-5' : '@2xl/chat:ml-10'}`}
      >
        <Text
          variant="medium"
          className={`text-textSecondary hidden leading-4 ${user === UserType.user ? 'xl:block' : ''}`}
        >
          {user}
        </Text>
        {isLoading ? (
          <div className="space-y-5">
            <TypingIndicator />
            <StopGeneratingButton />
          </div>
        ) : (
          <div className="space-y-5">
            <HStack className="items-center gap-x-[6px] space-x-0">
              {(isError || (isAuthError && !termsAccepted)) && (
                <ChatError className="mb-3 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 break-words text-white/75">
                {isFeedback && user === UserType.user ? (
                  <Accordion type="single" collapsible className="w-full overflow-hidden">
                    <AccordionItem value="feedback" className="border-none p-0">
                      <AccordionTrigger className="p-0 py-2 text-left hover:no-underline">
                        <Text className="italic">
                          <Trans>Feedback sent</Trans>
                        </Text>
                      </AccordionTrigger>
                      <AccordionContent className="overflow-hidden pt-2 pb-2 text-white">
                        {(() => {
                          const feedbackContent = getFeedbackContent();
                          if (!feedbackContent) {
                            // Show the raw message if parsing fails
                            return (
                              <Text variant="small" className="break-words text-white/75">
                                {message}
                              </Text>
                            );
                          }

                          // Check if this is a conversation rating feedback
                          const isConversationRating = feedbackContent.message.includes('rating-');
                          const isPositiveRating = feedbackContent.message.includes('rating-positive');

                          if (isConversationRating) {
                            // Show just the thumb icon for conversation ratings
                            return (
                              <HStack className="align-center items-center">
                                <Text variant="small" className="text-white/75">
                                  <Trans>Experience:</Trans>
                                </Text>
                                {isPositiveRating ? (
                                  <ThumbsUp size={14} className="text-gray-300" />
                                ) : (
                                  <ThumbsDown size={14} className="text-gray-300" />
                                )}
                              </HStack>
                            );
                          }

                          // Show full feedback details for non-conversation ratings
                          return (
                            <VStack className="gap-3">
                              <div className="min-w-0">
                                <Text variant="small" className="text-white/50">
                                  <Trans>Topics:</Trans>
                                </Text>
                                <Text variant="small" className="mt-1 break-words text-white/75">
                                  {feedbackContent.topics.join(', ')}
                                </Text>
                              </div>
                              <div className="min-w-0">
                                <Text variant="small" className="text-white/50">
                                  <Trans>Message:</Trans>
                                </Text>
                                <Text variant="small" className="mt-1 break-words text-white/75">
                                  {feedbackContent.message}
                                </Text>
                              </div>
                            </VStack>
                          );
                        })()}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <ChatMarkdownRenderer
                    markdown={
                      isAuthError && termsAccepted
                        ? t`Thank you for accepting the terms of service. You can now ask me anything.`
                        : isCanceled
                          ? t`User cancelled message`
                          : message
                    }
                  />
                )}
              </div>
            </HStack>
            {isAuthError && !termsAccepted && (
              <Button variant="pill" onClick={() => setShowTermsModal(true)} size="xs" className="px-4">
                {t`Accept Terms`}
              </Button>
            )}
            {user === UserType.bot && !isError && !isInternal && !isCanceled && !isAuthError && (
              <div className="space-y-5">
                {isOnlyMessage && suggestedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <Text variant="small" className="text-white/50">
                      <Trans>Suggested questions:</Trans>
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((question: string, index: number) => (
                        <Button
                          key={`${question}-${index}`}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuestionClick(question)}
                          className="h-auto px-3 py-2 text-left whitespace-normal"
                        >
                          {question}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {CHAT_SUGGESTIONS_ENABLED && intents && intents?.length > 0 && isLastMessage && (
                  <ChatIntentsRow intents={intents} />
                )}
                {showModifierRow && <ResponseModifierRow sendMessage={sendMessage} />}
              </div>
            )}
          </div>
        )}
      </VStack>
    </div>
  );
};
