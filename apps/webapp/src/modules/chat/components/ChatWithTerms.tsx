import React, { useState, useEffect } from 'react';
import { useConnection } from 'wagmi';
import { ChatPane } from '@/modules/app/components/ChatPane';
import { ChatbotTermsModal } from './ChatbotTermsModal';
import { useChatContext } from '../context/ChatContext';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useTermsAcceptance } from '../hooks/useTermsAcceptance';
import { triggerWalletAssociation } from '../services/walletTermsAssociation';
import { generateUUID } from '../lib/generateUUID';
import { MessageType, UserType, TERMS_ACCEPTANCE_MESSAGE } from '../constants';
import { getTermsContent, TermsType } from '@/modules/ui/components/terms-loader';

const parseTerms = (termsMarkdown: string) => {
  const lines = termsMarkdown.split('\n');
  const dateMatch = lines[0]?.match(/^\d{4}-\d{2}-\d{2}$/);

  if (dateMatch) {
    return {
      version: dateMatch[0],
      content: lines.slice(1).join('\n').trim(),
      isValid: true
    };
  }

  // Invalid format
  console.error('Terms document does not start with expected date format (YYYY-MM-DD)');
  return {
    version: '',
    content: t`# Invalid Terms Format

The terms document could not be loaded because it doesn't follow the expected format.

#### Expected Format:
The first line must contain a date in YYYY-MM-DD format (e.g., 2025-01-20), followed by the terms content.

#### What This Means:
We cannot present the terms for acceptance at this time. Please contact support if this issue persists.`,
    isValid: false
  };
};
interface ChatWithTermsProps {
  sendMessage: (message: string) => void;
}

export const ChatWithTerms: React.FC<ChatWithTermsProps> = ({ sendMessage }) => {
  const { i18n } = useLingui();
  const { address } = useConnection();

  const termsMarkdown = getTermsContent(TermsType.Chatbot);
  const parsedTerms = parseTerms(termsMarkdown);
  const termsVersion = parsedTerms.version;
  const termsContent = parsedTerms.content;
  const termsLoadedSuccessfully = parsedTerms.isValid;

  const {
    termsAccepted,
    showTermsModal,
    setShowTermsModal,
    termsError,
    isCheckingTerms,
    chatHistory,
    setChatHistory
  } = useChatContext();
  const { acceptTerms, checkTermsStatus } = useTermsAcceptance();

  const [isAccepting, setIsAccepting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [hasProcessedAuthError, setHasProcessedAuthError] = useState(false);

  // Send pending message after terms are accepted
  useEffect(() => {
    if (termsAccepted && !hasProcessedAuthError) {
      // Check if last bot message is an auth error
      const lastBotMessage = [...chatHistory].reverse().find(msg => msg.user === UserType.bot);
      const lastUserMessage = [...chatHistory].reverse().find(msg => msg.user === UserType.user);

      if (lastBotMessage?.type === MessageType.authError && lastUserMessage) {
        // Remove the last user message and auth error from history
        const filteredHistory = chatHistory.filter(
          msg => msg.id !== lastUserMessage.id && msg.id !== lastBotMessage.id
        );
        setChatHistory(filteredHistory);

        // Resend the user's message
        sendMessage(lastUserMessage.message);
        setHasProcessedAuthError(true);
      } else if (pendingMessage) {
        // Normal pending message flow
        sendMessage(pendingMessage);
        setPendingMessage(null);
      }
    }
  }, [termsAccepted, pendingMessage, sendMessage, chatHistory, setChatHistory, hasProcessedAuthError]);

  // Intercept sendMessage to check terms on first interaction
  const wrappedSendMessage = async (message: string) => {
    // Reset the auth error processed flag when user sends a new message
    setHasProcessedAuthError(false);

    if (!hasInteracted) {
      setHasInteracted(true);

      // Check terms status on first message
      if (!termsAccepted) {
        // Save the message to send after acceptance
        setPendingMessage(message);
        await checkTermsStatus();
        return;
      }
    }

    // If terms are accepted, send the message
    if (termsAccepted) {
      sendMessage(message);
    } else {
      // Save message and show dialog if terms not accepted
      setPendingMessage(message);
      setShowTermsModal(true);
    }
  };

  const handleAcceptTerms = async () => {
    setIsAccepting(true);
    try {
      await acceptTerms(termsVersion);
      if (address) {
        triggerWalletAssociation(address);
      }
    } catch {
      // Error is handled by the hook
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineTerms = () => {
    setShowTermsModal(false);

    // If user had a pending message, add it to chat history and show auth error
    if (pendingMessage) {
      setChatHistory(prevHistory => [
        ...prevHistory,
        {
          id: generateUUID(),
          user: UserType.user,
          message: pendingMessage
        },
        {
          id: generateUUID(),
          user: UserType.bot,
          message: i18n._(TERMS_ACCEPTANCE_MESSAGE),
          type: MessageType.authError
        }
      ]);
      setPendingMessage(null);
    }
  };

  return (
    <>
      <ChatPane sendMessage={wrappedSendMessage} />
      <ChatbotTermsModal
        isOpen={showTermsModal}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
        termsVersion={termsVersion}
        termsContent={termsContent}
        isLoading={isAccepting || isCheckingTerms}
        error={termsError}
        termsLoadedSuccessfully={termsLoadedSuccessfully}
      />
    </>
  );
};
