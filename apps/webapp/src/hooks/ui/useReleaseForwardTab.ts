import { RefObject, useEffect } from 'react';
import { FOCUSABLE_SELECTOR } from './useRestoreFocusOnClose';

/**
 * While `enabled`, Tab from a dialog's last control leaves the page instead of
 * wrapping to its first, so a wallet docked in the browser's side panel can be
 * reached while the dialog waits on it. Shift+Tab still wraps, and Radix's trap
 * still pulls focus back from anything else on the page.
 */
export function useReleaseForwardTab(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      const container = ref.current;
      if (!container) return;
      // Inert covers the step layers the modal keeps mounted behind the current one.
      const tabbable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        element =>
          element.tabIndex >= 0 && !element.closest('[inert]') && (element.checkVisibility?.() ?? true)
      );
      if (document.activeElement !== (tabbable.at(-1) ?? container)) return;
      // Radix's FocusScope wraps focus from React's listeners, which sit below the
      // document, so stopping the event here keeps it out of the way.
      event.stopPropagation();
      // The trailing focus guard would otherwise take the browser's own Tab and
      // hand focus straight back to the trap; skip it for this one keypress.
      const guard = document.querySelector<HTMLElement>('body > [data-radix-focus-guard]:last-child');
      if (!guard) return;
      guard.tabIndex = -1;
      setTimeout(() => (guard.tabIndex = 0));
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [ref, enabled]);
}
