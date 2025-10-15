import { motion, AnimatePresence } from 'framer-motion';
import { ChatWithTerms } from '@/modules/chat/components/ChatWithTerms';
import { QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useRef } from 'react';

interface FloatingChatPaneProps {
  sendMessage: (message: string) => void;
}

export const FloatingChatPane = ({ sendMessage }: FloatingChatPaneProps) => {
  const { bpi } = useBreakpointIndex();
  const [searchParams] = useSearchParams();
  const isChatOpen = searchParams.get(QueryParams.Chat) === 'true';
  const chatPaneRef = useRef<HTMLDivElement>(null);

  // Only show as floating on desktop (xl and above)
  const shouldShowFloating = bpi >= BP['3xl'] && isChatOpen;
  console.log('🚀 ~ FloatingChatPane ~ bpi:', bpi);

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
            className="bg-brandDark fixed bottom-[84px] right-6 z-[45] h-[calc(100vh-250px)] w-[440px] overflow-hidden rounded-3xl shadow-2xl xl:w-[465px]"
          >
            <ChatWithTerms sendMessage={sendMessage} scrollBehavior="auto" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
