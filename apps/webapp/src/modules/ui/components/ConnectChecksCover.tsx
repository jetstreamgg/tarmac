import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Trans } from '@lingui/react/macro';
import { SkyLogomarkSpinner } from '@/modules/app/components/SkyLogomarkSpinner';

/**
 * The gap between "wallet connected" and "we know what to ask you". Two checks
 * run back to back there — address screening (`/address/status` + `/ip/status`,
 * behind UnauthorizedPage) and then the terms `/check` — and neither has
 * anything to put in a card yet.
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
 */
export function ConnectChecksCover({ open }: { open: boolean }) {
  return (
    <DialogPrimitive.Root open={open} modal>
      <DialogPrimitive.Portal>
        {/* The scrim leaves 150ms LATER than it fades (`[animation-delay]`, not
            `delay-*` — that utility is transition-delay and does nothing to an
            animation). Two identically-recipe'd translucent layers cross-faded
            straight across sum to less than either alone, so the page would
            brighten mid-handoff; holding this one at full strength while the
            modal's own overlay ramps up keeps the frost monotonic. */}
        <DialogPrimitive.Overlay className="bg-modalOverlay app-loader-cover-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart fixed inset-0 z-50 backdrop-blur-[100px] data-[state=closed]:duration-150 data-[state=closed]:[animation-delay:150ms] data-[state=open]:duration-300" />
        {/* The logomark leaves on its own, undelayed: it must be gone before
            the terms card finishes rising, not linger over it. */}
        <DialogPrimitive.Content
          className="app-loader-cover-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:ease-out-quint data-[state=closed]:ease-in-out-quart fixed inset-0 z-50 flex items-center justify-center outline-hidden data-[state=closed]:duration-150 data-[state=open]:duration-300"
          onOpenAutoFocus={e => e.preventDefault()}
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
