import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ChatHistory, ChatIntent } from '../types/Chat';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/macro';
import { CHATBOT_NAME, MessageType, UserType } from '../constants';

interface ChatContextType {
  isLoading: boolean;
  chatHistory: ChatHistory[];
  confirmationModalOpened: boolean;
  selectedIntent: ChatIntent | undefined;
  modalShown: ChatIntent[];
  sessionId: string;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistory[]>>;
  setConfirmationModalOpened: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntent: React.Dispatch<React.SetStateAction<ChatIntent | undefined>>;
  setModalShown: React.Dispatch<React.SetStateAction<ChatIntent[]>>;
  hasShownIntent: (intent?: ChatIntent) => boolean;
}

const ChatContext = createContext<ChatContextType>({
  isLoading: false,
  chatHistory: [],
  setChatHistory: () => {},
  confirmationModalOpened: false,
  setConfirmationModalOpened: () => {},
  selectedIntent: undefined,
  setSelectedIntent: () => {},
  modalShown: [],
  setModalShown: () => {},
  sessionId: '',
  hasShownIntent: () => false
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
  const [confirmationModalOpened, setConfirmationModalOpened] = useState<boolean>(false);
  const [modalShown, setModalShown] = useState<ChatIntent[]>([]);
  const isLoading = chatHistory[chatHistory.length - 1]?.type === MessageType.loading;
  const hasShownIntent = useCallback(
    (intent?: ChatIntent) => {
      if (!intent) return false;
      return modalShown.some(i => i.intent_id === intent.intent_id);
    },
    [modalShown]
  );

  return (
    <ChatContext.Provider
      value={{
        chatHistory,
        setChatHistory,
        isLoading,
        confirmationModalOpened,
        setConfirmationModalOpened,
        selectedIntent,
        setSelectedIntent,
        modalShown,
        setModalShown,
        sessionId,
        hasShownIntent
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
