import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ChatHistory, ChatIntent } from '../types/Chat';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/macro';
import { CHATBOT_NAME, MessageType, UserType } from '../constants';
import { intentModifiesState } from '../lib/intentUtils';
import { checkTermsAcceptance } from '../api/chatbotTermsApi';

interface ChatContextType {
  isLoading: boolean;
  chatHistory: ChatHistory[];
  confirmationWarningOpened: boolean;
  selectedIntent: ChatIntent | undefined;
  warningShown: ChatIntent[];
  sessionId: string;
  shouldShowConfirmationWarning: boolean;
  shouldDisableActionButtons: boolean;
  hasAcceptedChatbotTerms: boolean;
  hasDeclinedChatbotTerms: boolean;
  isCheckingTermsAcceptance: boolean;
  showChatbotTermsDialog: boolean;
  pendingMessage: string | null;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistory[]>>;
  setConfirmationWarningOpened: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIntent: React.Dispatch<React.SetStateAction<ChatIntent | undefined>>;
  setWarningShown: React.Dispatch<React.SetStateAction<ChatIntent[]>>;
  hasShownIntent: (intent?: ChatIntent) => boolean;
  setShouldDisableActionButtons: React.Dispatch<React.SetStateAction<boolean>>;
  setHasAcceptedChatbotTerms: (accepted: boolean) => void;
  setHasDeclinedChatbotTerms: (declined: boolean) => void;
  setShowChatbotTermsDialog: (show: boolean) => void;
  setPendingMessage: (message: string | null) => void;
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
  setShouldDisableActionButtons: () => {},
  hasAcceptedChatbotTerms: false,
  hasDeclinedChatbotTerms: false,
  isCheckingTermsAcceptance: false,
  showChatbotTermsDialog: false,
  pendingMessage: null,
  setHasAcceptedChatbotTerms: () => {},
  setHasDeclinedChatbotTerms: () => {},
  setShowChatbotTermsDialog: () => {},
  setPendingMessage: () => {}
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
  const [hasAcceptedChatbotTerms, setHasAcceptedChatbotTermsState] = useState<boolean>(false);
  const [hasDeclinedChatbotTerms, setHasDeclinedChatbotTerms] = useState<boolean>(false);
  const [isCheckingTermsAcceptance, setIsCheckingTermsAcceptance] = useState<boolean>(true);
  const [showChatbotTermsDialog, setShowChatbotTermsDialog] = useState<boolean>(false);
  const [pendingMessage, setPendingMessageState] = useState<string | null>(null);
  const isLoading = chatHistory[chatHistory.length - 1]?.type === MessageType.loading;

  const setPendingMessage = (message: string | null) => {
    setPendingMessageState(message);
  };

  // Check chatbot terms acceptance on initial render
  useEffect(() => {
    const checkTerms = async () => {
      setIsCheckingTermsAcceptance(true);
      try {
        const status = await checkTermsAcceptance();
        setHasAcceptedChatbotTermsState(status.accepted);

        // Quick client-side expiration check
        if (status.accepted && status.expiresAt) {
          const expiresAt = new Date(status.expiresAt);
          if (expiresAt < new Date()) {
            setHasAcceptedChatbotTermsState(false);
          }
        }
      } catch (error) {
        console.error('Failed to check terms acceptance:', error);
        setHasAcceptedChatbotTermsState(false);
      } finally {
        setIsCheckingTermsAcceptance(false);
      }
    };

    checkTerms();
  }, []);

  // Function to update chatbot terms acceptance
  const setHasAcceptedChatbotTerms = useCallback((accepted: boolean) => {
    setHasAcceptedChatbotTermsState(accepted);
    // Reset declined state when accepting
    setHasDeclinedChatbotTerms(!accepted);
  }, []);

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
        setShouldDisableActionButtons,
        hasAcceptedChatbotTerms,
        hasDeclinedChatbotTerms,
        isCheckingTermsAcceptance,
        showChatbotTermsDialog,
        pendingMessage,
        setHasAcceptedChatbotTerms,
        setHasDeclinedChatbotTerms,
        setShowChatbotTermsDialog,
        setPendingMessage
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
