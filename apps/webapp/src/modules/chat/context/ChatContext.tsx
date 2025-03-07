import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ChatHistory, ChatIntent } from '../types/Chat';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/macro';
import { CHATBOT_NAME, MessageType, UserType } from '../constants';
import { intentModifiesState } from '../lib/intentUtils';

interface ChatContextType {
  isLoading: boolean;
  chatHistory: ChatHistory[];
  confirmationWarningOpened: boolean;
  selectedIntent: ChatIntent | undefined;
  warningShown: ChatIntent[];
  sessionId: string;
  shouldShowConfirmationWarning: boolean;
  shouldDisableActionButtons: boolean;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistory[]>>;
  setConfirmationWarningOpened: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntent: React.Dispatch<React.SetStateAction<ChatIntent | undefined>>;
  setWarningShown: React.Dispatch<React.SetStateAction<ChatIntent[]>>;
  hasShownIntent: (intent?: ChatIntent) => boolean;
  setShouldDisableActionButtons: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatContext = createContext<ChatContextType>({
  isLoading: false,
  chatHistory: [],
  setChatHistory: () => {},
  confirmationWarningOpened: false,
  setConfirmationWarningOpened: () => {},
  selectedIntent: undefined,
  setSelectedIntent: () => {},
  warningShown: [],
  setWarningShown: () => {},
  sessionId: '',
  hasShownIntent: () => false,
  shouldShowConfirmationWarning: false,
  shouldDisableActionButtons: false,
  setShouldDisableActionButtons: () => {}
});

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mock messages array to store chat history
  const messages = [
    {
      id: generateUUID(),
      user: UserType.bot,
      message: t`Hi, ${CHATBOT_NAME} here! How can I help you today?`
    }
  ];

  const sessionId = useMemo(() => generateUUID(), []);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>(messages);
  const [selectedIntent, setSelectedIntent] = useState<ChatIntent | undefined>(undefined);
  const [confirmationWarningOpened, setConfirmationWarningOpened] = useState<boolean>(false);
  const [warningShown, setWarningShown] = useState<ChatIntent[]>([]);
  const [shouldDisableActionButtons, setShouldDisableActionButtons] = useState<boolean>(false);
  const isLoading = chatHistory[chatHistory.length - 1]?.type === MessageType.loading;
  const hasShownIntent = useCallback(
    (intent?: ChatIntent) => {
      if (!intent) return false;
      return warningShown.some(i => i.intent_id === intent.intent_id);
    },
    [warningShown]
  );

  const modifiesState = intentModifiesState(selectedIntent);

  const shouldShowConfirmationWarning =
    !hasShownIntent(selectedIntent) && confirmationWarningOpened && modifiesState;

  return (
    <ChatContext.Provider
      value={{
        chatHistory,
        setChatHistory,
        isLoading,
        confirmationWarningOpened,
        setConfirmationWarningOpened,
        selectedIntent,
        setSelectedIntent,
        warningShown,
        setWarningShown,
        sessionId,
        hasShownIntent,
        shouldShowConfirmationWarning,
        shouldDisableActionButtons,
        setShouldDisableActionButtons
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
