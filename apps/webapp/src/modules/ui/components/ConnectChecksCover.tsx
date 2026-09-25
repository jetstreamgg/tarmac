import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Trans } from '@lingui/react/macro';
import { SkyLogomarkSpinner } from '@/modules/app/components/SkyLogomarkSpinner';
import { cn } from '@/lib/cn';

// APP-595: a close shorter than this is a blip between checks, not the end of them.
const CLOSE_HOLD_MS = 300;

// Module scope so it survives a remount of the tree above the cover.
let recentlyVisible = false;
let recentlyVisibleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The gap between "wallet connected" and "we know what to ask you". Two checks
 * run back to back there — the terms `/check`, then, when the terms must be
 * shown, address screening (`/address/status`, behind UnauthorizedPage, with
 * `/ip/status` alongside) — and neither has anything to put in a card yet.
 *
 * Both used to raise their own 300px "Please wait" card, so a connect showed
 * two of them in sequence and then grew into the 610px terms card.
 * `DialogContent` carries `transition: all 300ms`, so those swaps *animated*
 * width and height: the modal read as opening outward from its centre instead
 * of sliding up.
 *
 * This is one cover for both phases, mounted once by WalletChip — the spinner
 * never restarts across the handoff. It wears the DialogOverlay's scrim recipe
 * and the App Loader's logomark, so the terms modal's own overlay takes over
 * from an identical layer and the card is the only thing that arrives, rising
 * 40px like every other modal in the app.
 *
 * A real Radix dialog rather than a bare fixed layer: the wait can run for
 * several seconds (`checkTermsWithRetry` retries twice with a 1s backoff), and
 * a plain scrim would leave the page behind the blur scrollable, tabbable and
 * readable to a screen reader. This also gets the announcement right — the
 * sr-only `Title` is announced on open, the way the old card's title was,
 * which a `role="status"` region that enters the DOM already populated is not.
 *
 * Escape and outside interaction are inert: `open` is derived from the checks
 * in flight, so there is nothing for a dismissal to change.
 *
 * `open` dropping for a render, or the cover remounting, used to restart the
 * fade-in and flash the page (APP-595). A close is held for CLOSE_HOLD_MS, and
 * the cover skips the fade-in when it is open from its first render (a reload
 * with a remembered wallet: wagmi restores the address before first paint, so
 * screening is already running) or reopens right after being visible.
 */
export function ConnectChecksCover({ open }: { open: boolean }) {
  const [prevOpen, setPrevOpen] = useState(open);
  const [holding, setHolding] = useState(false);
  // The update below lands next render; read it now so `visible` never drops for a pass.
  let nextHolding = holding;
  if (open !== prevOpen) {
    setPrevOpen(open);
    nextHolding = !open;
    setHolding(nextHolding);
  }
  const visible = open || nextHolding;

  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), CLOSE_HOLD_MS);
    return () => clearTimeout(id);
  }, [holding]);

  const [prevVisible, setPrevVisible] = useState(visible);
  const [skipFade, setSkipFade] = useState(open);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    // Only a fresh open picks its entrance: swapping the fade classes on an
    // element already open would restart the fade from opacity 0.
    if (visible) setSkipFade(recentlyVisible);
  }

  useEffect(() => {
    if (!visible) return;
    return () => {
      recentlyVisible = true;
      clearTimeout(recentlyVisibleTimer);
      recentlyVisibleTimer = setTimeout(() => (recentlyVisible = false), CLOSE_HOLD_MS);
    };
  }, [visible]);

  const fadeIn = !skipFade && 'data-[state=open]:animate-in data-[state=open]:fade-in-0';

  return (
    <DialogPrimitive.Root open={visible} modal>
      <DialogPrimitive.Portal>
        {/* The scrim leaves 150ms LATER than it fades (`[animation-delay]`, not
            `delay-*` — that utility is transition-delay and does nothing to an
            animation). Two identically-recipe'd translucent layers cross-faded
            straight across sum to less than either alone, so the page would
            brighten mid-handoff; holding this one at full strength while the
            modal's own overlay ramps up keeps the frost monotonic. */}
        <DialogPrimitive.Overlay
          className={cn(
            'bg-modalOverlay app-loader-cover-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart fixed inset-0 z-50 backdrop-blur-[100px] data-[state=closed]:duration-150 data-[state=closed]:[animation-delay:150ms] data-[state=open]:duration-300',
            fadeIn
          )}
        />
        {/* The logomark leaves on its own, undelayed: it must be gone before
            the terms card finishes rising, not linger over it. */}
        <DialogPrimitive.Content
          // The overlay covers the whole window, released scrollbar column
          // included; the content box backs off by that column so the
          // logomark centres on the page, where the terms card it hands off
          // to will centre. Like the dialog card it reads the root's constant
          // `--page-scrollbar-gutter`, not the lock-keyed token (the cover is
          // its own lock, and the token lands a frame after it mounts), and
          // wears transition-none: the duration variants also set
          // transition-duration, and a moving inset would tween.
          className={cn(
            'app-loader-cover-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart fixed inset-0 right-[var(--page-scrollbar-gutter,0px)] z-50 flex items-center justify-center outline-hidden transition-none data-[state=closed]:duration-150 data-[state=open]:duration-300',
            fadeIn
          )}
          // Auto-focus is deliberately NOT prevented. The cover has no focusable
          // children, and Radix's FocusScope only arms its trap from whatever it
          // focused on mount: preventing it leaves `lastFocusedElementRef` null,
          // and the focusin redirect then calls `focus(null)`, a guarded no-op.
          // Tab would walk the page under the frost — `hideOthers` sets
          // `aria-hidden`, which does not remove tabbability, and the body's
          // `pointer-events: none` only stops the mouse. Letting it run focuses
          // the scope container itself (`tabIndex={-1}`), which arms the trap.
          onEscapeKeyDown={e => e.preventDefault()}
          onInteractOutside={e => e.preventDefault()}
          data-testid="connect-checks-cover"
        >
          <DialogPrimitive.Title className="sr-only">
            <Trans>Checking whether you can use Sky.money</Trans>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            <Trans>This only takes a moment.</Trans>
          </DialogPrimitive.Description>
          <SkyLogomarkSpinner />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
