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
    // Mobile tiers take the DS Mobile / Topbar padding (551:10137): 16px above
    // and below the chip row. The desktop tier follows the Navbar comp
    // (1030:61380 / 1036:201581): an 88px bar around the 40px pill row, i.e.
    // 24px (APP-456 #2 — the previous 8px sat the bar hard against the top
    // edge). The bar's own padding is the gap to the content now, so the extra
    // 4px margin is gone.
    'w-full py-4 desktop:py-6',
    // The bar's own `bg` layer, straight off the comps: the gradient-navbar
    // fill over background blur-md (Figma radius 12 ⇒ 6px). It lives on the bar
    // itself rather than on a child — `backdrop-filter` filters what is painted
    // *behind* the element, and the bar's own content (logo, pills) paints on
    // top of it untouched, so the child bought nothing the box doesn't already
    // give us. The gradient's fade to ~5% alpha is what softens the bottom
    // edge; there is no mask in the spec (APP-456 #6).
    'bg-linear-to-b from-navbarGradientStart to-navbarGradientEnd backdrop-blur-[6px]',
    // Pages scroll on the document, so the header pins as a sticky, see-through
    // frosted bar. Note that carrying a backdrop-filter makes the bar a
    // backdrop root for its descendants: anything nested here that wants its
    // own backdrop-filter would sample the bar, not the page. Nothing does —
    // the nav pills are borders and gradients, and both menus portal to body.
    'sticky top-0 z-30'
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
