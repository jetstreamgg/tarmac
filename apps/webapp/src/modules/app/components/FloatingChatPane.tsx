import { motion, AnimatePresence } from 'framer-motion';
import { ChatWithTerms } from '@/modules/chat/components/ChatWithTerms';
import { useRef, useState, useEffect } from 'react';
import { useFloatingChat } from '@/modules/chat/hooks/useFloatingChat';

interface FloatingChatPaneProps {
  sendMessage: (message: string) => void;
}

export const FloatingChatPane = ({ sendMessage }: FloatingChatPaneProps) => {
  const chatPaneRef = useRef<HTMLDivElement>(null);
  const { shouldShowFloating } = useFloatingChat();
  const [scrollBehavior, setScrollBehavior] = useState<ScrollBehavior>('auto');

  // When the chat opens, use 'auto' scroll, then switch to 'smooth' after 1500ms
  useEffect(() => {
    if (shouldShowFloating) {
      setScrollBehavior('auto');

      const timer = setTimeout(() => {
        setScrollBehavior('smooth');
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [shouldShowFloating]);

  return (
    <AnimatePresence>
      {shouldShowFloating && (
        <>
          {/* Floating chat panel - positioned to overlap button slightly */}
          <motion.div
            ref={chatPaneRef}
            initial={{ opacity: 0, x: 400, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 400, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-floatingChatPane fixed bottom-[84px] right-6 z-[45] h-[calc(100vh-250px)] max-h-[1080px] w-[440px] overflow-hidden rounded-3xl border shadow-2xl xl:w-[465px]"
          >
            <ChatWithTerms sendMessage={sendMessage} scrollBehavior={scrollBehavior} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
