import { cn } from '@/lib/utils';

/**
 * Class logic for the shell's two scroll modes (B6), extracted so the
 * mode-switch is testable without standing up Layout's provider tree.
 *
 * - Boxed (`fullWidth: false`): the legacy two-pane routes cap the surface to
 *   the viewport and scroll inside it.
 * - Full-width (`fullWidth: true`): destination routes scroll on the document;
 *   the surface drops its height cap and the header pins as a sticky frosted bar.
 */

/** The shell surface (the VStack wrapping the header + content). */
export const shellSurfaceClasses = (fullWidth: boolean) =>
  cn(
    // Dark: the sky image blended (luminosity) with the app container's #040434
    // backdrop so it takes that hue; light keeps the lilac gradient.
    'bg-app-background light:bg-blend-normal flex min-h-svh max-w-full items-center [background-color:#040434] bg-cover bg-center bg-no-repeat bg-blend-luminosity md:min-h-screen',
    // Boxed routes cap to the viewport and scroll inside the VStack; full-width
    // routes omit the cap so the document scrolls instead.
    !fullWidth && 'max-h-svh overflow-auto md:max-h-screen md:p-4 md:pb-2'
  );

/** The shell header row (logo + TopNav). */
export const shellHeaderClasses = (fullWidth: boolean) =>
  cn(
    'flex w-full items-center gap-4 px-3 py-2 sm:px-10 md:mb-1',
    // Full-width routes scroll on the document, so the header pins as a sticky,
    // see-through frosted bar (Figma: transparent + blur(7px), no opaque fill).
    fullWidth && 'sticky top-0 z-30',
    // Progressive blur: the blur lives on a `::before` overlay behind the nav
    // content (so logo + pills stay sharp), and a gradient mask feathers it out
    // toward the bottom — the blurred backdrop dissolves into the sharp content
    // instead of cutting at a hard line. The sticky header is the containing
    // block for the absolute pseudo, so no `relative` is needed.
    fullWidth &&
      "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[150%] before:backdrop-blur-[7px] before:content-[''] before:[mask-image:linear-gradient(to_bottom,#000_35%,transparent)] before:[-webkit-mask-image:linear-gradient(to_bottom,#000_35%,transparent)]"
  );
