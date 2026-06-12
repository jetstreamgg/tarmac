import { useCallback, useEffect, useState } from 'react';
import { Intent } from '@/lib/enums';
import { isNewIntent } from '@/lib/constants';
import { useRouteIntent } from '@/lib/navigation';

const NEW_INTENTS_SEEN_KEY = 'seenNewNavIntents';

function getSeenNewIntents(): Intent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEW_INTENTS_SEEN_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * "New" indicator state for recently launched modules (NEW_INTENTS). The dot
 * clears once the user lands on the module, regardless of how they got there,
 * and the seen state persists across sessions.
 */
export function useNewIntentDots() {
  const intent = useRouteIntent();
  const [seenNewIntents, setSeenNewIntents] = useState<Intent[]>(getSeenNewIntents);

  const markIntentSeen = useCallback((widgetIntent: Intent) => {
    setSeenNewIntents(prev => {
      if (!isNewIntent(widgetIntent) || prev.includes(widgetIntent)) return prev;
      const updated = [...prev, widgetIntent];
      try {
        localStorage.setItem(NEW_INTENTS_SEEN_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage write failures
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    markIntentSeen(intent);
  }, [intent, markIntentSeen]);

  const showNewDot = useCallback(
    (widgetIntent: Intent) => isNewIntent(widgetIntent) && !seenNewIntents.includes(widgetIntent),
    [seenNewIntents]
  );

  return { showNewDot };
}
