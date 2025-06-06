import { useToast } from '@/components/ui/use-toast';
import { CHATBOT_ENABLED } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useEffect } from 'react';

export const useDismissChatSuggestion = () => {
  const { userConfig, updateUserConfig } = useConfigContext();
  const { toasts, dismiss } = useToast();

  useEffect(() => {
    if (CHATBOT_ENABLED) {
      if (!userConfig.chatSuggested) {
        updateUserConfig({ ...userConfig, chatSuggested: true });
        // Dismiss chat notification
        const chatToast = toasts.find(toast => toast.variant === 'chat');
        if (chatToast) {
          dismiss(chatToast.id);
        }
      }
    }
  }, [userConfig, toasts]);
};
