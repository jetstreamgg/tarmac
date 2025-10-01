import { CHATBOT_ENABLED, CHAT_NOTIFICATION_KEY, CHAT_NOTIFICATION_TOAST_ID } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';

export const useDismissChatSuggestion = () => {
  const [chatSuggested, setChatSuggested] = useState(() => {
    return localStorage.getItem(CHAT_NOTIFICATION_KEY) === 'true';
  });

  useEffect(() => {
    if (CHATBOT_ENABLED) {
      if (!chatSuggested) {
        localStorage.setItem(CHAT_NOTIFICATION_KEY, 'true');
        setChatSuggested(true);
      }
      // Dismiss the specific chat notification toast when chat pane is visible
      toast.dismiss(CHAT_NOTIFICATION_TOAST_ID);
    }
  }, [chatSuggested]);
};
