import { cn } from '@/lib/utils';

/**
 * Class logic for the shell surface and header, extracted so it stays testable
 * without standing up Layout's provider tree.
 *
 * Every route scrolls on the document (G5): the surface carries no height cap
 * and no `overflow`, and the header pins as a sticky frosted bar. The boxed
 * mode — a viewport-capped surface the two-pane routes scrolled inside — died
 * with the last two-pane route, so these no longer branch on a mode.
 */

/**
 * Side gutter of the design-system page container, per the DS grid tiers
 * (Foundations / Grids & Spacing 5176:33992): 24px on the tablet tier (640 to
 * 1200), 20px elsewhere. The DS table lists 12px for the mobile tier, but the
 * mobile screen comps (Sky App: UI, 🟠 Mobile canvas, 393px frames) all place
 * page content at 20px — the 12px margin only shows up as the bottom Navbar's
 * in-situ inset. Shared by AppContainer and the header row so the header
 * content stays aligned with the page content at every tier.
 */
export const pageGutterClasses = 'px-5 sm:px-6 desktop:px-5';

/** The shell surface (the VStack wrapping the header + content). */
export const shellSurfaceClasses = () =>
  // The surface is transparent: the page background lives on the
  // viewport-fixed .app-background layer Layout renders behind it. No height
  // cap and no `overflow` — the document scrolls.
  'flex min-h-svh max-w-full items-center md:min-h-screen';

/** The shell header bar (full-bleed; the row content lives in the inner div). */
export const shellHeaderClasses = () =>
  cn(
    // Mobile tiers get the DS Mobile / Topbar vertical rhythm (16px, 68px bar
    // with the 36px chip row). The desktop tier follows the comp (Navbar
    // 1881:51590): an 88px bar around the 40px pill row, i.e. 24px above and
    // below (APP-456 #2 — the previous 8px sat the bar hard against the top
    // edge). The bar's own padding is the gap to the content now, so the extra
    // 4px margin is gone.
    'w-full py-3.5 desktop:py-6',
    // Pages scroll on the document, so the header pins as a sticky, see-through
    // frosted bar (Figma: transparent + blur(7px), no opaque fill).
    'sticky top-0 z-30',
    // Progressive blur: the blur lives on a `::before` overlay behind the nav
    // content (so logo + pills stay sharp), and a gradient mask feathers it out
    // toward the bottom. The overlay is confined to the bar itself (100%
    // height, mask fully transparent by 95%) — the earlier 150% overhang put a
    // frosted "white glow" band over page content, visible as an edge/color
    // difference below the header (APP-416); keeping any transition at the
    // bar's own boundary reads as a normal frosted navbar instead. The sticky
    // header is the containing block for the absolute pseudo, so no `relative`
    // is needed.
    "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-full before:backdrop-blur-[7px] before:content-[''] before:[mask-image:linear-gradient(to_bottom,#000_40%,transparent_95%)] before:[-webkit-mask-image:linear-gradient(to_bottom,#000_40%,transparent_95%)]"
  );

/** The header row content (logo + TopNav) inside the full-bleed bar. */
export const shellHeaderContentClasses = () =>
  cn(
    'flex items-center gap-4',
    // APP-415: at the desktop tier the row becomes the comp's three-flank grid
    // (Navbar 1036:201230 — equal 417|418|417 columns: logo | pills | wallet
    // cluster; TopNav dissolves via desktop:contents so its groups land in the
    // outer tracks). The pill group centers on the container axis — the same
    // center line as the page content — instead of the leftover flex space,
    // which sat it ~60px left and let it drift with wallet-chip width. `1fr`
    // tracks bottom out at min-content, so a long chip squeezes the flanks
    // (pills nudge off-center) rather than overlapping the pills.
    'desktop:grid desktop:grid-cols-[1fr_auto_1fr]',
    // The header content aligns with the design-system page container (same
    // max-width + gutter tiers as AppContainer).
    cn('mx-auto w-full max-w-[1320px]', pageGutterClasses)
  );
