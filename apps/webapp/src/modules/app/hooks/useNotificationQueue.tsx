import { useMemo, useRef } from 'react';

export interface NotificationConfig {
  id: string;
  priority: number; // Lower number = higher priority
  checkConditions: () => boolean;
  hasBeenShown: () => boolean;
  isReady?: () => boolean; // Optional: check if async data is ready
}

interface UseNotificationQueueResult {
  activeNotificationId: string | null;
  shouldShowNotification: (id: string) => boolean;
}

export const useNotificationQueue = (notifications: NotificationConfig[]): UseNotificationQueueResult => {
  // Track if we've already selected a notification for this session
  const selectedNotificationRef = useRef<string | null>(null);

  // Determine which notification to show based on priority and conditions
  const activeNotificationId = useMemo(() => {
    // If we've already selected a notification for this session, stick with it
    if (selectedNotificationRef.current !== null) {
      return selectedNotificationRef.current;
    }

    const sorted = [...notifications].sort((a, b) => a.priority - b.priority);

    const waitingForData = sorted.some(n => {
      if (n.hasBeenShown()) return false;

      // If this notification has isReady and it's false, we're waiting
      if (n.isReady && !n.isReady()) {
        return true;
      }

      return false;
    });

    // If we're waiting for data, don't select any notification yet
    if (waitingForData) {
      return null;
    }

    // Find first notification that:
    // 1. Hasn't been shown before
    // 2. Meets its conditions
    const activeNotification = sorted.find(n => {
      const hasBeenShown = n.hasBeenShown();
      const isReady = n.isReady ? n.isReady() : true; // Default to ready if no isReady function
      const meetsConditions = n.checkConditions();
      return !hasBeenShown && isReady && meetsConditions;
    });

    const notificationId = activeNotification?.id || null;

    if (notificationId) {
      selectedNotificationRef.current = notificationId;
    }

    return notificationId;
  }, [notifications]);

  const shouldShowNotification = (id: string): boolean => {
    return activeNotificationId === id;
  };

  return {
    activeNotificationId,
    shouldShowNotification
  };
};
