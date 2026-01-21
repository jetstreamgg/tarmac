import { motion } from 'framer-motion';
import { easeOutExpo } from '@/modules/ui/animation/timingFunctions';
import { ChatInput } from '@/modules/chat/components/ChatInput';
import { ChatHeader } from '@/modules/chat/components/ChatHeader';
import { ChatBubble } from '@/modules/chat/components/ChatBubble';
import { JurisdictionRestrictionCard } from '@/modules/chat/components/JurisdictionRestrictionCard';
import { useEffect, useRef, useState } from 'react';
import { formatMessage } from '@/modules/chat/lib/formatMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { useDismissChatSuggestion } from '../hooks/useDismissChatSuggestion';
import { useConversationFeedback } from '@/modules/chat/hooks/useConversationFeedback';
import { ConversationFeedbackPrompt } from '@/modules/chat/components/ConversationFeedbackPrompt';
import { ConversationFeedbackModal } from '@/modules/chat/components/ConversationFeedbackModal';
import { submitFeedback, FEEDBACK_TYPE } from '@/modules/chat/services/feedbackApi';
import { useChatbotFeedbackNotification } from '@/modules/chat/hooks/useChatbotFeedbackNotification';
import { isChatbotRestrictedError } from '@/modules/chat/lib/ChatbotRestrictedError';

export const ChatPane = ({
  sendMessage,
  scrollBehavior = 'smooth'
}: {
  sendMessage: (message: string) => void;
  scrollBehavior?: ScrollBehavior;
}) => {
  const {
    chatHistory,
    shouldShowConfirmationWarning,
    scrollTrigger,
    showConversationFeedback,
    setShowConversationFeedback,
    isLoading,
    sessionId,
    isRestricted,
    setIsRestricted,
    setChatHistory
  } = useChatContext();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isConversationFeedbackModalOpen, setIsConversationFeedbackModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'positive' | 'negative' | undefined>(undefined);
  const { showFeedbackSuccess } = useChatbotFeedbackNotification();

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: scrollBehavior
      });
    }
  }, [chatHistory, shouldShowConfirmationWarning, scrollTrigger, scrollBehavior]);

  // Manage conversation feedback prompt visibility
  useConversationFeedback({ chatHistory, setShowConversationFeedback });

  const handleRatingClick = (rating: 'positive' | 'negative') => {
    setSelectedRating(rating);
    setIsConversationFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (rating: 'positive' | 'negative', comment: string | null) => {
    try {
      await submitFeedback({
        feedback_type: rating === 'positive' ? FEEDBACK_TYPE.THUMBS_UP : FEEDBACK_TYPE.THUMBS_DOWN,
        comment,
        session_id: sessionId
      });

      // Show success notification on successful submission
      // Keep the feedback prompt visible to allow multiple submissions
      showFeedbackSuccess(rating);
    } catch (err) {
      if (isChatbotRestrictedError(err)) {
        setIsConversationFeedbackModalOpen(false);
        setIsRestricted(true);
        setChatHistory([]);
        return;
      }
      throw err;
    }
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
      {/* `chat-pane` class is used by the AppContainer component to make the container full width if the chat
      pane is visible */}
      <motion.div
        className="chat-pane md:bg-panel flex h-full w-full flex-col md:rounded-3xl"
        layout
        key="chat-pane"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ layout: { duration: 0 }, opacity: { duration: 0.5, ease: easeOutExpo } }}
      >
        <ChatHeader />
        {/* The @container/chat class allows to style children based on breakpoints on this container */}
        <div className="@container/chat h-[calc(100%-65px)] px-6 pt-[22px] pb-4 md:h-full xl:pt-8 xl:pb-5">
          <div className="mx-auto flex h-full max-w-[600px] flex-col justify-between gap-5">
            {isRestricted ? (
              <div className="flex flex-1 items-center justify-center">
                <JurisdictionRestrictionCard />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};
