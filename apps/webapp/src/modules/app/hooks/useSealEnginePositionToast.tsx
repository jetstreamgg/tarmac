import { useCallback, useEffect } from 'react';
import { useAppNavigate } from '@/lib/navigation';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { SEAL_ENGINE_NOTIFICATION_KEY } from '@/lib/constants';

/**
 * Notifies a connected wallet that still has MKR locked in the deprecated Seal Engine, linking to the
 * static /seal-engine withdrawal instructions page. Gated by the page-load notification queue so only
 * one notification shows per page load. Dismissal is persisted to localStorage.
 */
export const useSealEnginePositionToast = (isAuthorized: boolean) => {
  const navigate = useAppNavigate();

  const onClose = useCallback(() => {
    localStorage.setItem(SEAL_ENGINE_NOTIFICATION_KEY, 'true');
  }, []);

  useEffect(() => {
    // Only show if authorized by the notification queue
    if (!isAuthorized) {
      return;
    }

    // Add a small delay to ensure smooth UX
    const timer = setTimeout(() => {
      toastWithClose(
        toastId => (
          <div>
            <Text variant="medium" className="text-selectActive light:text-text">
              Seal Engine deprecated
            </Text>
            <VStack className="mt-4 gap-4">
              <Text variant="medium">
                You still have MKR supplied to the Seal Engine, which has been deprecated. You can withdraw
                your position at any time — the exit fee is now 0.
              </Text>
              <Button
                className="place-self-start"
                variant="pill"
                size="xs"
                onClick={() => {
                  navigate('/seal-engine');
                  toast.dismiss(toastId);
                  onClose();
                }}
              >
                Withdraw from Seal Engine
              </Button>
            </VStack>
          </div>
        ),
        {
          id: 'seal-engine-position-toast',
          duration: Infinity,
          dismissible: true,
          onDismiss: onClose
        }
      );
    }, 1000); // 1 second delay

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthorized, navigate, onClose]);
};
