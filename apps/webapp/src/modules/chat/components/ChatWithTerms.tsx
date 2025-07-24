import React, { useState, useEffect } from 'react';
import { ChatPane } from '@/modules/app/components/ChatPane';
import { ChatbotTermsModal } from './ChatbotTermsModal';
import { useChatContext } from '../context/ChatContext';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useTermsAcceptance } from '../hooks/useTermsAcceptance';
import { generateUUID } from '../lib/generateUUID';
import { MessageType, UserType, TERMS_ACCEPTANCE_MESSAGE } from '../constants';

interface ChatWithTermsProps {
  sendMessage: (message: string) => void;
}

export const ChatWithTerms: React.FC<ChatWithTermsProps> = ({ sendMessage }) => {
  // TODO: This may come from a url
  const TERMS_VERSION = '2025-07-15';
  const { i18n } = useLingui();
  const baseTerms = t`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.`;
  // TODO: Remove the Array.fill repetition once we have real terms from URL
  const TERMS_CONTENT = baseTerms ? Array(3).fill(baseTerms).join('\n\n') : undefined;

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
      await acceptTerms(TERMS_VERSION);
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
        termsVersion={TERMS_VERSION}
        termsContent={TERMS_CONTENT}
        isLoading={isAccepting || isCheckingTerms}
        error={termsError}
      />
    </>
  );
};
