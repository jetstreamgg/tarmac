import { NotificationType, TxStatus } from '@/widgets/shared/constants';
import { toast } from '@/components/ui/use-toast';
import { useCallback, useRef } from 'react';

const duration = 10000;
const NOTIFICATION_DEBOUNCE_MS = 2000; // Prevent duplicate notifications within 2 seconds

export const useNotification = () => {
  // Track last notification to prevent duplicates
  const lastNotificationRef = useRef<{
    type?: NotificationType;
    title?: string;
    timestamp: number;
  }>({ timestamp: 0 });

  const onNotification = useCallback(
    ({
      title,
      description,
      status,
      type
    }: {
      title: string;
      description: string;
      status: TxStatus;
      type?: NotificationType;
    }) => {
      const now = Date.now();
      const lastNotif = lastNotificationRef.current;

      // Check if this is a duplicate notification (same type and title within debounce window)
      const isDuplicate =
        lastNotif.type === type &&
        lastNotif.title === title &&
        now - lastNotif.timestamp < NOTIFICATION_DEBOUNCE_MS;

      if (isDuplicate) {
        return; // Skip duplicate notification
      }

      // Update last notification tracking
      lastNotificationRef.current = {
        type,
        title,
        timestamp: now
      };

      if (type && type !== NotificationType.INSUFFICIENT_BALANCE) {
        if (status === TxStatus.SUCCESS) {
          toast.success(title, {
            unstyled: true,
            description,
            duration,
            className: 'justify-start'
          });
        } else {
          toast.error(title, {
            unstyled: true,
            description,
            duration,
            className: 'justify-start'
          });
        }
      }
    },
    []
  );

  return onNotification;
};
