import { useCallback } from 'react';
import { toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { Trans } from '@lingui/react/macro';
import { ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';

const duration = 5000;

export function useChatbotFeedbackNotification() {
  const showFeedbackSuccess = useCallback((feedbackType: 'positive' | 'negative') => {
    const isPositive = feedbackType === 'positive';

    toastWithClose(
      <div>
        {/* <HStack>
          <img src="/images/chatbot_logo.svg" alt={`${CHATBOT_NAME} avatar`} className="h-5 w-5" />
          <Text variant="medium" className="text-selectActive ml-1">
            {CHATBOT_NAME}
          </Text>
        </HStack> */}
        <div className="ml-1">
          <HStack className="items-center gap-0">
            {isPositive ? (
              <ThumbsUp size={16} className="text-green-300/75" />
            ) : (
              <ThumbsDown size={16} className="text-orange-500" />
            )}
            <Text variant="medium">
              <Trans>Feedback sent!</Trans>
            </Text>
          </HStack>
          <Text variant="small" className="text-text/60 mt-2">
            {isPositive ? (
              <Trans>Thank you for the positive feedback.</Trans>
            ) : (
              <Trans>Thank you for helping us improve.</Trans>
            )}
          </Text>
        </div>
      </div>,
      {
        duration,
        dismissible: true
      }
    );
  }, []);

  const showFeedbackError = useCallback(() => {
    toastWithClose(
      <div>
        {/* <HStack>
          <img src="/images/chatbot_logo.svg" alt={`${CHATBOT_NAME} avatar`} className="h-5 w-5" />
          <Text variant="medium" className="text-selectActive ml-1">
            {CHATBOT_NAME}
          </Text>
        </HStack> */}
        <div className="ml-1">
          <HStack className="items-center gap-0">
            <AlertCircle size={16} className="text-error" />
            <Text variant="medium">
              <Trans>Feedback not sent</Trans>
            </Text>
          </HStack>
          <Text variant="small" className="text-text/60 mt-2">
            <Trans>Something went wrong. Please try again later.</Trans>
          </Text>
        </div>
      </div>,
      {
        duration,
        dismissible: true
      }
    );
  }, []);

  return { showFeedbackSuccess, showFeedbackError };
}
