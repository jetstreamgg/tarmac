import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatContext } from '../context/ChatContext';
import { ChatIntent } from '../types/Chat';
import { intentModifiesState } from '../lib/intentUtils';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';

export const useIntentExecution = () => {
  const { setConfirmationWarningOpened, setSelectedIntent, setChatHistory, hasShownIntent } =
    useChatContext();
  const navigate = useNavigate();

  const executeIntent = useCallback(
    (intent: ChatIntent, targetUrl: string) => {
      const modifiesState = intentModifiesState(intent);

      setConfirmationWarningOpened(false);

      if (!hasShownIntent(intent) && modifiesState) {
        setConfirmationWarningOpened(true);
        setSelectedIntent(intent);
      } else {
        setChatHistory(prev => [...prev, intentSelectedMessage(intent)]);
        navigate(targetUrl);
      }
    },
    [setConfirmationWarningOpened, setSelectedIntent, setChatHistory, hasShownIntent, navigate]
  );

  return executeIntent;
};
