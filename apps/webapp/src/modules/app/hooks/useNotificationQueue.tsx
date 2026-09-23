import { useMemo, useState } from 'react';

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
  // Once a notification has been picked for this session it stays picked,
  // even if the candidates change underneath it.
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  // The notification that would show now, by priority and conditions.
  const candidateId = useMemo(() => {
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

    return activeNotification?.id || null;
  }, [notifications]);

  if (selectedNotificationId === null && candidateId !== null) {
    setSelectedNotificationId(candidateId);
  }
  const activeNotificationId = selectedNotificationId ?? candidateId;

  const shouldShowNotification = (id: string): boolean => {
    return activeNotificationId === id;
  };

  return {
    activeNotificationId,
    shouldShowNotification
  };
};
