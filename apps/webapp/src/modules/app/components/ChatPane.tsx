import { motion } from 'framer-motion';
import { easeOutExpo } from '@/modules/ui/animation/timingFunctions';
import { ChatInput } from '@/modules/chat/components/ChatInput';
import { ChatHeader } from '@/modules/chat/components/ChatHeader';
import { ChatBubble } from '@/modules/chat/components/ChatBubble';
import { useEffect, useRef } from 'react';
import { formatMessage } from '@/modules/chat/lib/formatMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { useDismissChatSuggestion } from '../hooks/useDismissChatSuggestion';

export const ChatPane = ({
  sendMessage,
  scrollBehavior = 'smooth'
}: {
  sendMessage: (message: string) => void;
  scrollBehavior?: ScrollBehavior;
}) => {
  const { chatHistory, shouldShowConfirmationWarning, scrollTrigger } = useChatContext();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: scrollBehavior
      });
    }
  }, [chatHistory, shouldShowConfirmationWarning, scrollTrigger, scrollBehavior]);

  useDismissChatSuggestion();

  return (
    // `chat-pane` class is used by the AppContainer component to make the container full width if the chat pane is visible
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
          </div>
          <ChatInput sendMessage={sendMessage} />
        </div>
      </div>
    </motion.div>
  );
};
