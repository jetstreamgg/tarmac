import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { useNewIntentDots } from '@/modules/app/hooks/useNewIntentDots';
import { DESTINATIONS, useActiveDestinationPath, useDestinationLinkProps } from './destinations';
import { useHideOnScroll } from './useHideOnScroll';

const mobileNavTestId = (path: string) => `mobile-nav-${path.slice(1)}`;

/**
 * Bottom navigation bar for the mobile tiers (DS Mobile / Navbar, Figma
 * 5153:25322 — in situ at Sky App: UI 536:26374). Fixed to the bottom edge on
 * a fade-to-background gradient; hidden at the desktop tier where TopNav's
 * pill group takes over. The active recipe reuses the navbar button variant
 * (aria-current="page" → brand2 gradient + dim border), same as desktop.
 */
export function MobileNavbar() {
  const activePath = useActiveDestinationPath();
  const { showNewDot } = useNewIntentDots();
  const { searchForIntent, handleNavClick } = useDestinationLinkProps();
  const isHidden = useHideOnScroll();

  return (
    <nav
      data-testid="mobile-navbar"
      data-state={isHidden ? 'hidden' : 'visible'}
      className={cn(
        'from-pageBackground/0 to-pageBackground desktop:hidden fixed inset-x-0 bottom-0 z-30 flex bg-gradient-to-b px-3 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]',
        // M2.1: slide out while scrolling down, back in on scroll up. The bar
        // is fixed, so the transform doesn't reflow the page.
        // in-out rather than the app's ease-out-expo: expo front-loads ~80% of
        // the travel into the first 100ms, which reads as a snap, not a slide.
        'transition-transform duration-500 ease-in-out data-[state=hidden]:translate-y-full motion-reduce:transition-none'
      )}
    >
      <div className="bg-glassSurface mx-auto flex h-[60px] w-full max-w-md flex-1 rounded-full p-1 backdrop-blur-[20px]">
        {DESTINATIONS.map(destination => {
          const isActive = activePath === destination.path;
          const Icon = destination.icon;
          return (
            <Link
              key={destination.path}
              to={destination.path}
              search={searchForIntent(destination.intents[0])}
              onClick={handleNavClick(destination.intents[0])}
              data-testid={mobileNavTestId(destination.path)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'navbar' }),
                // Inactive items are borderless icon-only pills sharing the row
                // equally; the variant's aria-current recipe restores the
                // border + gradient on the active one.
                'font-circle relative h-full min-w-0 flex-1 gap-1 rounded-full border-transparent px-2 text-xs leading-[14px] font-medium tracking-[-0.24px]'
              )}
            >
              <Icon className="nav-icon h-4 w-4 shrink-0" />
              {/* DS shows the label on the active pill only; sr-only keeps the
                  icon-only items accessibly named. */}
              <span className={isActive ? undefined : 'sr-only'}>{destination.label}</span>
              {destination.intents.some(showNewDot) && (
                <span
                  data-testid={`${mobileNavTestId(destination.path)}-new-dot`}
                  className="bg-textEmphasis absolute top-2 right-1/2 h-1.5 w-1.5 translate-x-3.5 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
