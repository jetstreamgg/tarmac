import { Button } from '@/components/ui/button';
import { QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useFloatingChat } from '@/modules/chat/hooks/useFloatingChat';
import { Chat } from '@/modules/icons';

export const FloatingChatButton = () => {
  const [, setSearchParams] = useSearchParams();
  const { supportsFloatingChat, isChatOpen } = useFloatingChat();

  const handleClick = () => {
    setSearchParams(params => {
      params.set(QueryParams.Chat, isChatOpen ? 'false' : 'true');
      return params;
    });
  };

  return (
    <AnimatePresence>
      {supportsFloatingChat && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed right-6 bottom-6 z-50"
        >
          <Button
            onClick={handleClick}
            className="bg-floatingChatPane focus:bg-floatingChatPane hover:bg-floatingChatPane/90 active:bg-floatingChatPane focus-visible:bg-floatingChatPane h-14 w-14 rounded-full border p-0 shadow-lg transition-all hover:scale-105"
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
          >
            <AnimatePresence mode="wait">
              {isChatOpen ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={24} />
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Chat width={24} height={24} />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
