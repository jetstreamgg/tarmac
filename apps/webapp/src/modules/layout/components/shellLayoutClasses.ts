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
 * (Foundations / Grids & Spacing 5176:33992): 24px on the S tier (640 to
 * 1200), 20px elsewhere. The DS table lists 12px for the mobile tier, but the
 * mobile screen comps (Sky App: UI, 🟠 Mobile canvas, 393px frames) all place
 * page content at 20px — the 12px margin only shows up as the bottom Navbar's
 * in-situ inset. The Design QA tablet-grid frames (2800:91684 — 1022px of app
 * beside a wallet extension panel) widen the gutter to 32px from the tablet
 * seam (APP-549), where the header keeps its desktop pills. Shared by
 * AppContainer and the header row so the header content stays aligned with
 * the page content at every tier.
 */
export const pageGutterClasses = 'px-5 sm:px-6 lg:px-8 desktop:px-5';

/** The shell surface (the VStack wrapping the header + content). */
export const shellSurfaceClasses = () =>
  // The surface is transparent: the page background lives on the
  // viewport-fixed .app-background layer Layout renders behind it. No height
  // cap and no `overflow` — the document scrolls.
  //
  // pr-[var(--page-scrollbar-pad)]: on routes with no page scrollbar the
  // surface pads its right edge by the bar's width so the header and content
  // sit where they do when the bar is present (usePageScrollbarCompensation
  // sets the variable; 0 with overlay scrollbars and whenever the bar shows).
  // The fixed background image shows through the pad.
  'flex min-h-svh max-w-full items-center pr-[var(--page-scrollbar-pad,0px)] md:min-h-screen';

/** The shell header bar (full-bleed; the row content lives in the inner div). */
export const shellHeaderClasses = () =>
  cn(
    // The phone tier takes the DS Mobile / Topbar padding (551:10137): 16px
    // above and below the chip row. From the tablet seam up the bar follows
    // the Navbar comp (1030:61380 / 1036:201581, and 2800:91699 at the tablet
    // grid): an 88px bar around the 40px pill row, i.e. 24px (APP-456 #2 — the
    // previous 8px sat the bar hard against the top edge). The bar's own
    // padding is the gap to the content now, so the extra 4px margin is gone.
    'w-full py-4 lg:py-6',
    // The bar's own `bg` layer, straight off the comps: the gradient-navbar
    // fill over background blur-md (Figma radius 12 ⇒ 6px). It lives on the bar
    // itself rather than on a child — `backdrop-filter` filters what is painted
    // *behind* the element, and the bar's own content (logo, pills) paints on
    // top of it untouched, so the child bought nothing the box doesn't already
    // give us (APP-456 #6).
    //
    // The comp's two stops run to 5% alpha, and stopping there left a visible
    // line where that 5% met the bare page. So the DS ramp plays out over the
    // first three quarters of the bar and the last quarter carries it to fully
    // transparent: same bar, no edge to see.
    'bg-linear-to-b from-navbarGradientStart via-navbarGradientEnd via-75% to-transparent backdrop-blur-[6px]',
    // Pages scroll on the document, so the header pins as a sticky, see-through
    // frosted bar. The Earn Opportunities heading's scroll-mt-24 (EarnPage)
    // budgets for this bar's height — revisit it if the bar grows. Note that
    // carrying a backdrop-filter makes the bar a backdrop root for its
    // descendants: anything nested here that wants its own backdrop-filter
    // would sample the bar, not the page. Nothing does — the nav pills are
    // borders and gradients, and both menus portal to body.
    'sticky top-0 z-30'
  );

/** The header row content (logo + TopNav) inside the full-bleed bar. */
export const shellHeaderContentClasses = () =>
  cn(
    'flex items-center gap-4',
    // APP-415: from the tablet seam up the row becomes the comp's three-flank
    // grid (Navbar 1036:201230 — equal 417|418|417 columns: logo | pills |
    // wallet cluster; TopNav dissolves via lg:contents so its groups land in
    // the outer tracks). The pill group centers on the container axis — the
    // same center line as the page content — instead of the leftover flex
    // space, which sat it ~60px left and let it drift with wallet-chip width.
    // `1fr` tracks bottom out at min-content, so at desktop a long chip
    // squeezes the flanks (pills nudge off-center) rather than overlapping the
    // pills; on the tablet tier the chip truncates instead (TopNav).
    'lg:grid lg:grid-cols-[1fr_auto_1fr]',
    // The header content aligns with the design-system page container (same
    // max-width + gutter tiers as AppContainer).
    cn('mx-auto w-full max-w-[1320px]', pageGutterClasses)
  );
