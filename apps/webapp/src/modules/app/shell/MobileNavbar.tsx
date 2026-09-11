import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { DESTINATIONS, useActiveDestinationPath, useDestinationLinkProps } from './destinations';
import { useHideOnScroll } from './useHideOnScroll';

const mobileNavTestId = (path: string) => `mobile-nav-${path.slice(1)}`;

/**
 * Bottom navigation bar for the mobile tiers (DS Mobile / Navbar, Figma
 * 5153:25322 — in situ at Sky App: UI 536:26374). Fixed to the bottom edge on
 * a fade-to-background gradient; phone tier only — from the tablet seam (lg,
 * 912) up TopNav's pill group takes over (APP-549).
 *
 * The active recipe (brand2 gradient + dim border, same tokens as the desktop
 * navbar variant) is painted by one shared motion element instead of the
 * variant's aria-current styles, so on tab switch it slides from the old
 * destination to the new one. Not design-specced — engineering default, like
 * the M2.1 scroll behavior.
 */
export function MobileNavbar() {
  const activePath = useActiveDestinationPath();
  const { navSearch, handleNavClick } = useDestinationLinkProps('mobile_drawer');
  const isHidden = useHideOnScroll();
  const reducedMotion = useReducedMotion();
  // One clock for everything that moves on a tab switch: the pill's glide, the
  // leaving label's collapse and the arriving label's expansion. Sharing it is
  // what keeps the icons travelling with the pill instead of snapping to their
  // new centres the frame the route changes.
  const switchTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, duration: 0.45, bounce: 0.15 };

  return (
    // `motion.nav` + `layoutScroll`: the active pill below is a layout animation
    // inside a `position: fixed` box, and motion converts every measurement to
    // page coordinates by adding the window scroll — an offset a fixed element
    // never moved by. A route change resets the document to the top between the
    // pill's two measurements, so the entire scroll position landed in the
    // animation and the pill flew in from that far below the bar (APP-518;
    // measured at 600px of scroll, the pill entered exactly 600px low).
    // `layoutScroll` is what makes motion measure this element's own scroll,
    // and measuring is the only path on which it records the node as a scroll
    // root — which it is, by `position: fixed` — so descendants stop having the
    // page scroll folded in.
    <motion.nav
      layoutScroll
      data-testid="mobile-navbar"
      data-state={isHidden ? 'hidden' : 'visible'}
      className={cn(
        'from-pageBackground/0 to-pageBackground fixed inset-x-0 bottom-0 z-30 flex bg-gradient-to-b pt-4 pr-[calc(0.75rem+var(--page-released-gutter,0px))] pb-[max(16px,env(safe-area-inset-bottom))] pl-3 lg:hidden',
        // Centred on the viewport, which is also the page's centre: the root
        // reserves the scrollbar's column on every route (scrollbar-gutter in
        // globals.css). Under a scroll lock the column is released so a scrim
        // can cover it, and the bar spans the widened window while the page
        // holds still — the right pad grows by the released column
        // (`--page-released-gutter`, 0 at rest) so the pill stays put.
        // Captured alongside the page during a route transition so the page's
        // snapshot — which paints in the top layer, above every z-index in the
        // document — passes behind the bar instead of over it (APP-518). The
        // hook is inert outside a running transition; rules in globals.css.
        'vt-shell-navbar',
        // M2.1: slide out while scrolling down, back in on scroll up. The bar
        // is fixed, so the transform doesn't reflow the page.
        // in-out rather than the app's ease-out-expo: expo front-loads ~80% of
        // the travel into the first 100ms, which reads as a snap, not a slide.
        'transition-transform duration-500 ease-in-out data-[state=hidden]:translate-y-full motion-reduce:transition-none'
      )}
    >
      {/* `vt-navbar-glass`: while the bar is captured its `backdrop-filter` has
          nothing to sample, so globals.css stands a flat colour in behind the
          tint for the length of the transition. Inert at rest. */}
      <div className="bg-glassSurface vt-navbar-glass mx-auto flex h-[60px] w-full max-w-md flex-1 rounded-full p-1 backdrop-blur-[20px]">
        {DESTINATIONS.map(destination => {
          const isActive = activePath === destination.path;
          const Icon = destination.icon;
          return (
            <Link
              key={destination.path}
              to={destination.path}
              search={navSearch}
              onClick={handleNavClick(destination.path)}
              data-testid={mobileNavTestId(destination.path)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'navbar' }),
                'font-circle relative h-full min-w-0 flex-1 gap-0 rounded-full border-transparent px-2 text-xs leading-[14px] font-medium tracking-[-0.24px]',
                // The shared pill supplies the active fill/border, so the
                // variant's own aria-current recipe is switched off (it would
                // double-paint and can't animate between items).
                'aria-[current=page]:border-transparent aria-[current=page]:bg-none'
              )}
            >
              {isActive && (
                <motion.span
                  aria-hidden
                  data-testid="mobile-nav-active-pill"
                  // One layoutId across the four links: when the active link
                  // changes, the pill glides to its new home. First child +
                  // positioned siblings keep it under the icon/label without
                  // z-index games.
                  layoutId="mobile-nav-active-pill"
                  transition={switchTransition}
                  className="border-borderBrandDim from-brand2-start to-brand2-end absolute inset-0 rounded-full border bg-linear-to-b"
                />
              )}
              <Icon className="nav-icon relative h-4 w-4 shrink-0" />
              {/* Every item is named by one sr-only span, always mounted; the
                  visible label below is decorative (aria-hidden), so an
                  outgoing label still collapsing next to an inactive item
                  can't read the name twice. DS shows the label on the active
                  pill only. The label owns its WIDTH as
                  an animated value: an unmounting label used to drop its box in
                  one frame (the old icon snapped to the link's centre) while
                  the arriving one took its full box at opacity 0 (the new icon
                  snapped aside to make room). Both now travel over the pill's
                  own clock — the leaving copy collapses to 0 as the arriving
                  one expands to its measured width. The icon-label gap rides
                  inside the animated box as `marginLeft`, so a collapsed label
                  leaves no 4px stub behind. */}
              <span className="sr-only">{destination.label}</span>
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.span
                    key="label"
                    aria-hidden
                    className="relative overflow-hidden whitespace-nowrap"
                    initial={reducedMotion ? false : { width: 0, opacity: 0, marginLeft: 0 }}
                    animate={{ width: 'auto', opacity: 1, marginLeft: 4 }}
                    exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                    transition={switchTransition}
                  >
                    {destination.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
