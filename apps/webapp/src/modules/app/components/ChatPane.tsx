import { motion } from 'framer-motion';
import { easeOutExpo } from '@/modules/ui/animation/timingFunctions';
import { ChatInput } from '@/modules/chat/components/ChatInput';
import { ChatHeader } from '@/modules/chat/components/ChatHeader';
import { ChatBubble } from '@/modules/chat/components/ChatBubble';
import { useEffect, useRef, useState } from 'react';
import { formatMessage } from '@/modules/chat/lib/formatMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { useDismissChatSuggestion } from '../hooks/useDismissChatSuggestion';
import { ConversationFeedbackPrompt } from '@/modules/chat/components/ConversationFeedbackPrompt';
import { ConversationFeedbackModal } from '@/modules/chat/components/ConversationFeedbackModal';
import { UserType, MessageType } from '@/modules/chat/constants';

const CONVERSATION_RATING_PREFIX = '/feedback conversation-rating-';
// Note: for now if you don't attach a message after the part "conversation-rating-", the chatbot won't acknowledge the feedback in its response
const CONVERSATION_RATING_POSITIVE = 'conversation-rating-positive, positive';
const CONVERSATION_RATING_NEGATIVE = 'conversation-rating-negative, negative';

export const ChatPane = ({ sendMessage }: { sendMessage: (message: string) => void }) => {
  const {
    chatHistory,
    shouldShowConfirmationWarning,
    scrollTrigger,
    showConversationFeedback,
    setShowConversationFeedback,
    isLoading
  } = useChatContext();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isConversationFeedbackModalOpen, setIsConversationFeedbackModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'positive' | 'negative' | undefined>(undefined);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, shouldShowConfirmationWarning, scrollTrigger]);

  // Show conversation feedback prompt only for internal bot messages (excludes loading, error, etc.)
  useEffect(() => {
    const lastMessage = chatHistory[chatHistory.length - 1];
    const isLastMessageBot = lastMessage?.user === UserType.bot;
    const isLoadingMessage = lastMessage?.type === MessageType.loading;
    const isNotInitialMessage = chatHistory.length > 1;
    const isLongEnoughConversation = chatHistory.length >= 7;

    // Check if total bot message content exceeds 1000 characters
    const totalBotMessageLength = chatHistory
      .filter(msg => msg.user === UserType.bot)
      .reduce((total, msg) => total + msg.message.length, 0);
    const hasSufficientBotContent = totalBotMessageLength > 1000;

    const shouldShowFeedback =
      isNotInitialMessage &&
      isLastMessageBot &&
      !isLoadingMessage &&
      isLongEnoughConversation &&
      hasSufficientBotContent;

    // Check only the last 10 messages for recent conversation feedback
    const recentMessages = chatHistory.slice(-10);
    const hasRecentConversationFeedback = recentMessages.some(
      msg => msg.user === UserType.user && msg.message.startsWith(CONVERSATION_RATING_PREFIX)
    );

    // Show feedback when last message is internal bot message and no recent conversation feedback was given
    if (shouldShowFeedback && !hasRecentConversationFeedback) {
      setShowConversationFeedback(true);
    } else if (hasRecentConversationFeedback) {
      // Hide feedback prompt if conversation feedback was just submitted
      setShowConversationFeedback(false);
    }
  }, [chatHistory, setShowConversationFeedback]);

  const handleRatingClick = (rating: 'positive' | 'negative') => {
    setSelectedRating(rating);
    setIsConversationFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = (rating: 'positive' | 'negative') => {
    const topic = rating === 'positive' ? CONVERSATION_RATING_POSITIVE : CONVERSATION_RATING_NEGATIVE;
    const feedbackMessage = `/feedback ${topic}`;
    sendMessage(feedbackMessage);
    setIsConversationFeedbackModalOpen(false);
    setShowConversationFeedback(false);
  };

  useDismissChatSuggestion();

  return (
    <>
      {/* Conversation Feedback Modal */}
      <ConversationFeedbackModal
        isOpen={isConversationFeedbackModalOpen}
        onClose={() => setIsConversationFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
        initialRating={selectedRating}
      />

      {/* Chat Pane */}
      <motion.div
        className="chat-pane md:bg-panel flex h-full w-full flex-col group-has-[.details-pane]:w-[324px] md:rounded-3xl"
        layout
        key="chat-pane"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ layout: { duration: 0 }, opacity: { duration: 0.5, ease: easeOutExpo } }}
      >
        <ChatHeader />
        {/* The @container/chat class allows to style children based on breakpoints on this container */}
        <div className="@container/chat h-[calc(100%-65px)] px-6 pb-4 pt-[22px] md:h-full xl:pb-5 xl:pt-8">
          <div className="mx-auto flex h-full max-w-[600px] flex-col justify-between gap-5">
            <div
              ref={chatContainerRef}
              className="scrollbar-thin-always flex w-full flex-col gap-10 overflow-y-auto pr-2 xl:gap-8"
            >
              {chatHistory.map(({ user, message, type, intents }, index) => {
                const formattedMessage = formatMessage(message);
                const isLastMessage = index === chatHistory.length - 1 && index !== 0;
                const isFirstMessage = index === 0;
                return (
                  <ChatBubble
                    key={index}
                    user={user}
                    message={formattedMessage}
                    type={type}
                    isLastMessage={isLastMessage}
                    intents={intents}
                    sendMessage={sendMessage}
                    showModifierRow={!isFirstMessage && isLastMessage}
                    isFirstMessage={isFirstMessage}
                    isOnlyMessage={chatHistory.length === 1}
                  />
                );
              })}

              {/* Conversation Feedback Prompt */}
              <div className={`w-full ${showConversationFeedback ? '' : 'invisible'}`}>
                <ConversationFeedbackPrompt onRatingClick={handleRatingClick} disabled={isLoading} />
              </div>
            </div>
            <ChatInput sendMessage={sendMessage} />
          </div>
        </div>
      </motion.div>
    </>
  );
};
