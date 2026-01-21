import { useEffect } from 'react';
import { UserType, MessageType } from '@/modules/chat/constants';
import type { ChatHistory } from '@/modules/chat/types/Chat';

interface UseConversationFeedbackParams {
  chatHistory: ChatHistory[];
  setShowConversationFeedback: (show: boolean) => void;
}

/**
 * Custom hook to manage conversation feedback prompt visibility based on chat history.
 *
 * Shows feedback prompt when:
 * - Conversation has at least 3 messages (greeting, first user message, first bot response)
 * - Last message is from the bot and is a valid response (text or internal)
 * - Excluded message types: loading, error, canceled, authError
 * - Once shown, keeps it visible to allow multiple feedback submissions throughout the conversation
 *
 * Note: Feedback is now submitted via the /feedback API endpoint with toast notifications,
 * not as chat messages, so we don't check for feedback message prefixes anymore.
 */
export const useConversationFeedback = ({
  chatHistory,
  setShowConversationFeedback
}: UseConversationFeedbackParams): void => {
  useEffect(() => {
    const lastMessage = chatHistory[chatHistory.length - 1];

    const isLastMessageBot = lastMessage?.user === UserType.bot;
    // Valid responses: text, internal
    // Excluded: loading, error, canceled, authError
    const isValidAnswer =
      lastMessage?.type !== MessageType.loading &&
      lastMessage?.type !== MessageType.error &&
      lastMessage?.type !== MessageType.canceled &&
      lastMessage?.type !== MessageType.authError;
    const hasEnoughMessages = chatHistory.length >= 3; // greeting message, first user message, last bot message

    const shouldShowFeedback = hasEnoughMessages && isLastMessageBot && isValidAnswer;

    // Show feedback when conditions are met
    // Once shown, it stays visible (no logic to hide it)
    if (shouldShowFeedback) {
      setShowConversationFeedback(true);
    }
  }, [chatHistory, setShowConversationFeedback]);
};
