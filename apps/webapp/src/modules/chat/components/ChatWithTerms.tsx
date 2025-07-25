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
  const { i18n } = useLingui();
  const [termsVersion, setTermsVersion] = useState<string>(''); // TODO: Update this mock date when real terms document is ready
  const [termsContent, setTermsContent] = useState<string | undefined>(undefined);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);
  const [termsLoadError, setTermsLoadError] = useState<string | null>(null);
  const [termsLoadedSuccessfully, setTermsLoadedSuccessfully] = useState(false);

  // TODO: Update this URL to the final terms document location
  const TERMS_URL = 'https://raw.githubusercontent.com/jetstreamgg/tarmac/main/README.md';

  // Fetch terms from GitHub
  useEffect(() => {
    const fetchTerms = async () => {
      setIsLoadingTerms(true);
      setTermsLoadError(null);
      setTermsLoadedSuccessfully(false);

      try {
        const response = await fetch(TERMS_URL);
        if (!response.ok) {
          throw new Error('Failed to fetch terms');
        }

        let text = await response.text();

        // TODO: Remove this mock date prepending when the real terms document includes the date
        // Prepend mock date to simulate the expected format
        const mockDate = '2025-07-15';
        text = `${mockDate}\n${text}`;

        // Parse the first line as date
        // Expected format:
        // 2025-07-15
        // Terms content...

        const lines = text.split('\n');
        const dateMatch = lines[0]?.match(/^\d{4}-\d{2}-\d{2}$/);

        if (dateMatch) {
          setTermsVersion(dateMatch[0]);
          setTermsContent(lines.slice(1).join('\n').trim());
          setTermsLoadedSuccessfully(true);
        } else {
          // Invalid format - terms not loaded successfully
          console.error('Terms document does not start with expected date format (YYYY-MM-DD)');
          setTermsLoadError(
            t`Invalid terms format. The terms document must start with a date in YYYY-MM-DD format.`
          );

          // Show error content
          const errorContent = t`# Invalid Terms Format

The terms document could not be loaded because it doesn't follow the expected format.

#### Expected Format:
The first line must contain a date in YYYY-MM-DD format (e.g., 2025-01-20), followed by the terms content.

#### What This Means:
We cannot present the terms for acceptance at this time. Please contact support if this issue persists.`;

          setTermsContent(errorContent);
          setTermsLoadedSuccessfully(false);
        }
      } catch (error) {
        console.error('Error fetching terms:', error);
        setTermsLoadError(t`Failed to load terms. Please try again later.`);
        // Fallback to error message content
        const fallbackTerms = t`# Unable to Load Terms

We're currently unable to fetch the latest terms and conditions. This may be due to a network issue or temporary service disruption.

## What you can do:

1. **Check your internet connection** - Ensure you have a stable connection
2. **Refresh the page** - Try reloading to fetch the terms again
3. **Try again later** - The service may be temporarily unavailable

## Important Notice

By using this chatbot service, you acknowledge that terms and conditions apply. We recommend reviewing them once they're available.

If this issue persists, please contact support for assistance.`;
        setTermsContent(fallbackTerms);
      } finally {
        setIsLoadingTerms(false);
      }
    };

    fetchTerms();
  }, [TERMS_URL]);

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
        isLoading={isAccepting || isCheckingTerms || isLoadingTerms}
        error={termsError || termsLoadError}
        termsLoadedSuccessfully={termsLoadedSuccessfully}
      />
    </>
  );
};
