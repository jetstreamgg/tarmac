import { useRef } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';

/**
 * Registers `details_open` as a PostHog super property
 * so every event automatically carries the current panel state.
 *
 * Call once in a component that's always mounted (e.g. DualSwitcher).
 * The property updates whenever the URL query params change.
 */
export function usePanelSuperProperties() {
  const posthog = usePostHog();
  const [searchParams] = useSearchParams();

  const detailsOpen = !(searchParams.get(QueryParams.Details) === 'false');

  // Only call register when values actually change
  const prevRef = useRef<{ details: boolean } | null>(null);
  if (posthog && (!prevRef.current || prevRef.current.details !== detailsOpen)) {
    prevRef.current = { details: detailsOpen };
    try {
      posthog.register({ details_open: detailsOpen });
    } catch {
      // Analytics should never break the app
    }
  }
}
