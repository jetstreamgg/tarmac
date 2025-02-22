import { useToast } from '@/components/ui/use-toast';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useEffect } from 'react';

export const useDismissChatSuggestion = () => {
  const { userConfig, updateUserConfig } = useConfigContext();
  const { toasts, dismiss } = useToast();

  const chatEnabled = import.meta.env.VITE_CHATBOT_ENABLED === 'true';

  useEffect(() => {
    if (chatEnabled) {
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
