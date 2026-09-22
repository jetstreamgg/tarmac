import { useCallback, useRef } from 'react';

type AutoFocusHandler = (event: Event) => void;

/**
 * Radix's modal Dialog returns focus to its `Dialog.Trigger` on close and
 * nowhere else, and it prevents the FocusScope default that would do the rest.
 * Every dialog here opens from controlled state, so the trigger ref is empty
 * and focus falls to the body. This reads the opener from `onOpenAutoFocus` —
 * it fires just before focus moves into the content — and hands it back on
 * close. Spread the returned handlers onto the content; the caller's own are
 * still called, and a caller that prevents the close event keeps control.
 */
export function useRestoreFocusOnClose({
  onOpenAutoFocus,
  onCloseAutoFocus
}: {
  onOpenAutoFocus?: AutoFocusHandler;
  onCloseAutoFocus?: AutoFocusHandler;
}) {
  const openerRef = useRef<HTMLElement | null>(null);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus]
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const opener = openerRef.current;
      if (opener?.isConnected) {
        event.preventDefault();
        opener.focus();
      }
    },
    [onCloseAutoFocus]
  );

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus };
}
