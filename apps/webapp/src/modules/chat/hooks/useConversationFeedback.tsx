import { useEffect } from 'react';
import { UserType, MessageType } from '@/modules/chat/constants';
import type { ChatHistory } from '@/modules/chat/types/Chat';

const CONVERSATION_RATING_PREFIX = '/feedback conversation-rating-';

interface UseConversationFeedbackParams {
  chatHistory: ChatHistory[];
  setShowConversationFeedback: (show: boolean) => void;
}

/**
 * Custom hook to manage conversation feedback prompt visibility based on chat history.
 *
 * Shows feedback prompt when:
 * - Conversation has at least 7 messages
 * - Last message is from the bot (not loading)
 * - Total bot message content exceeds 1000 characters
 * - No recent conversation feedback has been given (checks last 10 messages)
 */
export const useConversationFeedback = ({
  chatHistory,
  setShowConversationFeedback
}: UseConversationFeedbackParams): void => {
  useEffect(() => {
    const lastMessage = chatHistory[chatHistory.length - 1];
    const isLastMessageBot = lastMessage?.user === UserType.bot;
    const isLoadingMessage = lastMessage?.type === MessageType.loading;
    const isNotInitialMessage = chatHistory.length > 1;
    const isLongEnoughConversation = chatHistory.length >= 7;

    // Check if total bot message content exceeds 1000 characters
    const totalBotMessageLength = chatHistory
      .filter(msg => msg.user === UserType.bot)
      .reduce((total, msg) => total + msg.message.length, 0);
    const hasSufficientBotContent = totalBotMessageLength > 1000;

    const shouldShowFeedback =
      isNotInitialMessage &&
      isLastMessageBot &&
      !isLoadingMessage &&
      isLongEnoughConversation &&
      hasSufficientBotContent;

    // Check only the last 10 messages for recent conversation feedback
    const recentMessages = chatHistory.slice(-10);
    const hasRecentConversationFeedback = recentMessages.some(
      msg => msg.user === UserType.user && msg.message.startsWith(CONVERSATION_RATING_PREFIX)
    );

    // Show feedback when last message is internal bot message and no recent conversation feedback was given
    if (shouldShowFeedback && !hasRecentConversationFeedback) {
      setShowConversationFeedback(true);
    } else if (hasRecentConversationFeedback) {
      // Hide feedback prompt if conversation feedback was just submitted
      setShowConversationFeedback(false);
    }
  }, [chatHistory, setShowConversationFeedback]);
};
