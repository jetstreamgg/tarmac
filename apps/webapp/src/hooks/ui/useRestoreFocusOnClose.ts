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
 *
 * The opener can refuse focus by then — a stake takeover's Confirm is disabled
 * while its transaction is pending — so focus falls back to the dialog the
 * opener sits in, rather than out of it to the body.
 */
export function useRestoreFocusOnClose({
  onOpenAutoFocus,
  onCloseAutoFocus
}: {
  onOpenAutoFocus?: AutoFocusHandler;
  onCloseAutoFocus?: AutoFocusHandler;
}) {
  const openerRef = useRef<HTMLElement | null>(null);
  const openerDialogRef = useRef<HTMLElement | null>(null);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      openerDialogRef.current = openerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus]
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const opener = openerRef.current;
      const openerDialog = openerDialogRef.current;
      if (!opener?.isConnected && !openerDialog?.isConnected) return;
      event.preventDefault();
      opener?.focus();
      if (document.activeElement !== opener) openerDialog?.focus();
    },
    [onCloseAutoFocus]
  );

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus };
}
