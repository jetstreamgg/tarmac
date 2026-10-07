import { useCallback, useRef } from 'react';

type AutoFocusHandler = (event: Event) => void;

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Recent focus targets, newest last. A dialog opened from a menu item outlives
// the item, so the element focused before it (the menu's trigger) is the one
// to hand focus back to. Pressed controls count too: Safari doesn't focus a
// button on click, so without them the newest entry could be something the
// user left long ago, far down the page.
const focusHistory: HTMLElement[] = [];
const record = (element: HTMLElement) => {
  if (focusHistory.at(-1) === element) return;
  focusHistory.push(element);
  if (focusHistory.length > 50) focusHistory.shift();
};
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    event => {
      if (event.target instanceof HTMLElement) record(event.target);
    },
    true
  );
  document.addEventListener(
    'pointerdown',
    event => {
      if (!(event.target instanceof Element)) return;
      const pressed = event.target.closest<HTMLElement>(FOCUSABLE_SELECTOR);
      if (pressed) record(pressed);
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
const focusFallbackFor = (element: HTMLElement | null) =>
  lastFocusOutside([element, element?.closest<HTMLElement>('[role="dialog"]') ?? null]);

/**
 * Read when a dialog opens: who opened it, then where focus goes if the opener
 * can't take it back on close, in order:
 * - the dialog the opener sits in (a takeover whose Confirm is disabled while
 *   its transaction is pending);
 * - the element focused before the opener, outside its dialog (the More
 *   button, when Upgrade opened from its menu and the menu has closed).
 */
export function captureFocusOrigin() {
  const active = document.activeElement;
  const opener = active instanceof HTMLElement && active !== document.body ? active : lastFocusOutside([]);
  const openerDialog = opener?.closest<HTMLElement>('[role="dialog"]') ?? null;
  return [opener, openerDialog, focusFallbackFor(opener)];
}

/**
 * Hands focus back from the dialog `closing` to the first of `candidates` that
 * takes it, then to the topmost open modal (a takeover that replaced position
 * details, whose row is inert behind it). Leaves focus alone when another
 * dialog already holds it: that one opened while this one animated out.
 * Returns whether focus is settled.
 */
export function restoreFocus(candidates: (HTMLElement | null)[], closing: Node | null) {
  const active = document.activeElement;
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'));
  if (dialogs.some(dialog => dialog.contains(active) && !(closing && dialog.contains(closing)))) return true;

  const openModals = dialogs.filter(dialog => dialog.getAttribute('aria-modal') === 'true').reverse();
  for (const [index, candidate] of [...candidates, ...openModals].entries()) {
    if (!candidate?.isConnected || candidate.closest('[inert]')) continue;
    if (closing && (candidate.contains(closing) || closing.contains(candidate))) continue;
    candidate.focus({ preventScroll: index > 0 });
    if (document.activeElement === candidate) return true;
  }
  return false;
}

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
  const candidatesRef = useRef<(HTMLElement | null)[]>([]);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      candidatesRef.current = captureFocusOrigin();
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus]
  );

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const closing = event.target instanceof Node ? event.target : null;
      if (restoreFocus(candidatesRef.current, closing)) event.preventDefault();
    },
    [onCloseAutoFocus]
  );

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus };
}
