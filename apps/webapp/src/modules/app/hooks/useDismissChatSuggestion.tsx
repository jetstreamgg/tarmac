import { useToast } from '@/components/ui/use-toast';
import { CHATBOT_ENABLED, CHAT_NOTIFICATION_KEY } from '@/lib/constants';
import { useEffect, useState } from 'react';

export const useDismissChatSuggestion = () => {
  const { toasts, dismiss } = useToast();
  const [chatSuggested, setChatSuggested] = useState(() => {
    return localStorage.getItem(CHAT_NOTIFICATION_KEY) === 'true';
  });

  useEffect(() => {
    if (CHATBOT_ENABLED) {
      if (!chatSuggested) {
        localStorage.setItem(CHAT_NOTIFICATION_KEY, 'true');
        setChatSuggested(true);
        // Dismiss chat notification
        const chatToast = toasts.find(toast => toast.variant === 'chat');
        if (chatToast) {
          dismiss(chatToast.id);
        }
      }
    }
  }, [chatSuggested, toasts, dismiss]);
};
