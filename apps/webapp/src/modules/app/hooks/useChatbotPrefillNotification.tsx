import { useCallback, useRef } from 'react';
import { toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';

export function useChatbotPrefillNotification() {
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPrefillNotification = useCallback(() => {
    // Clear any existing timeout to prevent multiple toasts
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Small delay to ensure widget has rendered before showing notification
    toastTimeoutRef.current = setTimeout(() => {
      toastWithClose(
        <div>
          {/* <HStack>
            <img src="/images/chatbot_logo.svg" alt={`${CHATBOT_NAME} avatar`} className="h-5 w-5" />
            <Text variant="medium" className="text-selectActive ml-1">
              {CHATBOT_NAME}
            </Text>
          </HStack> */}
          <div className="ml-1">
            <Text variant="medium">
              <Trans>I&apos;ve prefilled the transaction details based on your selection.</Trans>
            </Text>
            <Text variant="small" className="text-text/60 mt-1">
              <Trans>Please review the values before proceeding.</Trans>
            </Text>
          </div>
        </div>,
        {
          duration: 5000,
          dismissible: true
        }
      );

      // Clear the ref after the toast is shown
      toastTimeoutRef.current = null;
    }, 3000); // Small delay for better UX
  }, []);

  return { showPrefillNotification };
}
