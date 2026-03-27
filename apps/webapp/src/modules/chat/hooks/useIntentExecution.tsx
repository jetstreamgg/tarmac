import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatContext } from '../context/ChatContext';
import { ChatIntent } from '../types/Chat';
import { intentModifiesState, hasPreFillParameters } from '../lib/intentUtils';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { useChatbotPrefillNotification } from '@/modules/app/hooks/useChatbotPrefillNotification';
import { useChatAnalytics } from './useChatAnalytics';

export const useIntentExecution = () => {
  const { setConfirmationWarningOpened, setSelectedIntent, setChatHistory, hasShownIntent } =
    useChatContext();
  const { trackIntentClicked } = useChatAnalytics();
  const navigate = useNavigate();
  const { showPrefillNotification } = useChatbotPrefillNotification();

  const executeIntent = useCallback(
    (intent: ChatIntent, targetUrl: string) => {
      const modifiesState = intentModifiesState(intent);

      trackIntentClicked({ intent_title: intent.title, intent_widget: intent.widget });
      setConfirmationWarningOpened(false);

      if (!hasShownIntent(intent) && modifiesState) {
        setConfirmationWarningOpened(true);
        setSelectedIntent(intent);
      } else {
        setChatHistory(prev => [...prev, intentSelectedMessage(intent)]);
        navigate(targetUrl);
        // Show notification only if the intent has pre-fill parameters
        if (hasPreFillParameters(intent)) {
          showPrefillNotification();
        }
      }
    },
    [
      setConfirmationWarningOpened,
      setSelectedIntent,
      setChatHistory,
      hasShownIntent,
      navigate,
      showPrefillNotification,
      trackIntentClicked
    ]
  );

  return executeIntent;
};
