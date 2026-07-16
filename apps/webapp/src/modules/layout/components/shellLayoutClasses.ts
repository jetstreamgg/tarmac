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

/**
 * Side gutter of the design-system page container, per the DS grid tiers
 * (Foundations / Grids & Spacing 5176:33992): 24px on the tablet tier (640 to
 * 1200), 20px elsewhere. The DS table lists 12px for the mobile tier, but the
 * mobile screen comps (Sky App: UI, 🟠 Mobile canvas, 393px frames) all place
 * page content at 20px — the 12px margin only shows up as the bottom Navbar's
 * in-situ inset. Shared by the bare AppContainer and the full-width header row
 * so the header content stays aligned with the page content at every tier.
 */
export const pageGutterClasses = 'px-5 sm:px-6 desktop:px-5';

/** The shell surface (the VStack wrapping the header + content). */
export const shellSurfaceClasses = (fullWidth: boolean) =>
  cn(
    // The surface is transparent: the page background lives on the
    // viewport-fixed .app-background layer Layout renders behind it.
    'flex min-h-svh max-w-full items-center md:min-h-screen',
    // Boxed routes cap to the viewport and scroll inside the VStack; full-width
    // routes omit the cap so the document scrolls instead.
    !fullWidth && 'max-h-svh overflow-auto md:max-h-screen md:p-4 md:pb-2'
  );

/** The shell header bar (full-bleed; the row content lives in the inner div). */
export const shellHeaderClasses = (fullWidth: boolean) =>
  cn(
    // Mobile tiers get the DS Mobile / Topbar vertical rhythm (16px, 68px bar
    // with the 36px chip row); the desktop tier keeps the legacy 8px.
    'w-full py-3.5 desktop:py-2 desktop:mb-1',
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

/** The header row content (logo + TopNav) inside the full-bleed bar. */
export const shellHeaderContentClasses = (fullWidth: boolean) =>
  cn(
    'flex items-center gap-4',
    // Full-width routes align the header content with the design-system page
    // container (same max-width + gutter tiers as the bare AppContainer);
    // boxed routes keep the legacy full-bleed padding. 20px side padding is
    // also the DS Mobile / Topbar gutter, so both modes share it on the
    // mobile tier.
    fullWidth ? cn('mx-auto w-full max-w-[1320px]', pageGutterClasses) : 'w-full px-5 sm:px-10'
  );
