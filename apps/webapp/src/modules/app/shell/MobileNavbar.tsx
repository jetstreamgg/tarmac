import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
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
  const { searchForIntent, handleNavClick } = useDestinationLinkProps('mobile_drawer');
  const isHidden = useHideOnScroll();
  const reducedMotion = useReducedMotion();

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
        'from-pageBackground/0 to-pageBackground fixed inset-x-0 bottom-0 z-30 flex bg-gradient-to-b px-3 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden',
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
              search={searchForIntent(destination.intents[0])}
              onClick={handleNavClick(destination.intents[0], destination.path)}
              data-testid={mobileNavTestId(destination.path)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'navbar' }),
                'font-circle relative h-full min-w-0 flex-1 gap-1 rounded-full border-transparent px-2 text-xs leading-[14px] font-medium tracking-[-0.24px]',
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
                  transition={
                    reducedMotion ? { duration: 0 } : { type: 'spring', duration: 0.45, bounce: 0.15 }
                  }
                  className="border-borderBrandDim from-brand2-start to-brand2-end absolute inset-0 rounded-full border bg-linear-to-b"
                />
              )}
              <Icon className="nav-icon relative h-4 w-4 shrink-0" />
              {/* DS shows the label on the active pill only; sr-only keeps the
                  icon-only items accessibly named. The reveal trails the pill
                  so the text fades in where the pill lands. */}
              {isActive ? (
                <motion.span
                  className="relative"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.15 }}
                >
                  {destination.label}
                </motion.span>
              ) : (
                <span className="sr-only">{destination.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
