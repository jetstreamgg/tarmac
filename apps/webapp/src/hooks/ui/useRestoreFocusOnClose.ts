import { useCallback, useRef } from 'react';

type AutoFocusHandler = (event: Event) => void;

// Recent focus targets, newest last. A dialog opened from a menu item outlives
// the item, so the element focused before it (the menu's trigger) is the one
// to hand focus back to.
const focusHistory: HTMLElement[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    event => {
      if (!(event.target instanceof HTMLElement)) return;
      focusHistory.push(event.target);
      if (focusHistory.length > 50) focusHistory.shift();
    },
    true
  );
}

const lastFocusOutside = (exclude: (HTMLElement | null)[]) =>
  focusHistory.findLast(
    el => el.isConnected && el !== document.body && !exclude.some(container => container?.contains(el))
  ) ?? null;

/**
 * Where to send focus when `element` can't take it back: the element focused
 * before it, outside `element` and the dialog it sits in. For a control in a
 * menu or modal that has since closed, that's what opened the menu or modal.
 */
export const focusFallbackFor = (element: HTMLElement | null) =>
  lastFocusOutside([element, element?.closest<HTMLElement>('[role="dialog"]') ?? null]);

/**
 * Radix's modal Dialog returns focus to its `Dialog.Trigger` on close and
 * nowhere else, and it prevents the FocusScope default that would do the rest.
 * Every dialog here opens from controlled state, so the trigger ref is empty
 * and focus falls to the body. This reads the opener from `onOpenAutoFocus` —
 * it fires just before focus moves into the content — and hands it back on
 * close. Spread the returned handlers onto the content; the caller's own are
 * still called, and a caller that prevents the close event keeps control.
 *
 * The opener can refuse focus by then, so it falls back, in order, to:
 * - the dialog the opener sits in (a takeover whose Confirm is disabled while
 *   its transaction is pending);
 * - the element focused before the opener, outside its dialog (the More
 *   button, when Upgrade opened from its menu and the menu has closed);
 * - the topmost open modal (a takeover that replaced position details, whose
 *   row is inert behind it).
 */
export function useRestoreFocusOnClose({
  onOpenAutoFocus,
  onCloseAutoFocus
}: {
  onOpenAutoFocus?: AutoFocusHandler;
  onCloseAutoFocus?: AutoFocusHandler;
}) {
  const fallbacksRef = useRef<(HTMLElement | null)[]>([]);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      const active = document.activeElement;
      const opener =
        active instanceof HTMLElement && active !== document.body ? active : lastFocusOutside([]);
      const openerDialog = opener?.closest<HTMLElement>('[role="dialog"]') ?? null;
      fallbacksRef.current = [opener, openerDialog, focusFallbackFor(opener)];
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus]
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const closing = event.target instanceof Node ? event.target : null;
      const openModals = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).reverse();
      for (const candidate of [...fallbacksRef.current, ...openModals]) {
        if (!candidate?.isConnected || candidate.closest('[inert]')) continue;
        if (closing && (candidate.contains(closing) || closing.contains(candidate))) continue;
        candidate.focus();
        if (document.activeElement === candidate) {
          event.preventDefault();
          return;
        }
      }
    },
    [onCloseAutoFocus]
  );

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus };
}
