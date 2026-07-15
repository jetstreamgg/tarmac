import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { BATCH_TX_ENABLED } from '@/lib/constants';
import { useNewIntentDots } from '@/modules/app/hooks/useNewIntentDots';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BatchTransactionsToggle } from '@/components/BatchTransactionsToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletChip } from './WalletChip';
import { MockConnectButton } from '@/modules/layout/components/MockConnectButton';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';
import { POSTHOG_ENABLED } from '@/modules/analytics/PostHogProvider';
import { DESTINATIONS, navTestId, useActiveDestinationPath, useDestinationLinkProps } from './destinations';

// Design-system Button / Navbar (Figma 5010:29059, Default type); active
// styling keys off the link's aria-current="page".
const navItemClasses = cn(buttonVariants({ variant: 'navbar', size: 'navbar' }), 'relative');

// Design-system Dropdown row (Figma Components/Dropdown 5075:17292): Label 5
// on fg-primary, 16/12 padding, hover rows tint bg-secondary.
const moreItemClasses =
  'text-fgPrimary hover:bg-bgSecondary font-circle px-4 py-3 text-left text-sm leading-4 font-medium tracking-[-0.28px] transition-colors';

/** Secondary actions that don't earn a destination: batch toggle, legal links. */
function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { showBanner } = useCookieConsent();
  const footerLinks = getFooterLinks();
  const closeMenu = () => setIsOpen(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {/* Menu type of Button / Navbar: Radix supplies data-state=open for the
          active recipe, and the glyph flips hamburger → X while open. */}
      <PopoverTrigger
        data-testid="nav-more"
        aria-label="More"
        className={cn(buttonVariants({ variant: 'navbar', size: 'navbar' }), 'w-10 px-0')}
      >
        {isOpen ? <X size={16} className="nav-menu-icon" /> : <Menu size={16} className="nav-menu-icon" />}
      </PopoverTrigger>
      {/* DS Dropdown panel chrome (bg-tertiary glass, 16px radius, 1/4px inset). */}
      <PopoverContent
        align="end"
        className="bg-bgTertiary flex w-60 flex-col rounded-2xl px-px py-1 shadow-none backdrop-blur-[20px]"
      >
        <div className="flex items-center gap-1 px-3 py-1">
          <ThemeToggle />
          {BATCH_TX_ENABLED && <BatchTransactionsToggle />}
        </div>
        {footerLinks.map(link => {
          const url = sanitizeUrl(link.url);
          if (!url) return null;
          return (
            <ExternalLink key={url} href={url} showIcon={false} className={moreItemClasses}>
              {link.name}
            </ExternalLink>
          );
        })}
        {POSTHOG_ENABLED && (
          <button
            data-testid="nav-more-cookie-settings"
            onClick={() => {
              closeMenu();
              showBanner();
            }}
            className={moreItemClasses}
          >
            <Trans>Cookie settings</Trans>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Final 4-destination top navigation. */
export function TopNav() {
  const activePath = useActiveDestinationPath();
  const { showNewDot } = useNewIntentDots();
  const { searchForIntent, handleNavClick } = useDestinationLinkProps();

  return (
    <nav className="flex w-full items-center gap-3" data-testid="top-nav">
      {/* Shared gradient for the selected nav icon (dark mode); referenced by
          fill: url(#nav-icon-gradient) in globals.css. Bounding-box units span
          each glyph exactly (Figma's per-icon ramp), which relies on every nav
          icon being a single path — a multi-path icon would restart the ramp
          per subelement. Stops are gradient-brand2 at full opacity. */}
      <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="nav-icon-gradient" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop stopColor="#949AFF" />
            <stop offset="1" stopColor="#504DFF" />
          </linearGradient>
        </defs>
      </svg>
      {/* mx-auto centers the pill group between the logo (left, in Layout) and
          the chip cluster. Below the desktop tier the destinations live in the
          bottom MobileNavbar instead (M2), so the pill group hides. */}
      <div className="desktop:flex mx-auto hidden items-center gap-2">
        {DESTINATIONS.map(destination => {
          const isActive = activePath === destination.path;
          const Icon = destination.icon;
          return (
            <Link
              key={destination.path}
              to={destination.path}
              search={searchForIntent(destination.intents[0])}
              onClick={handleNavClick(destination.intents[0])}
              data-testid={navTestId(destination.path)}
              aria-current={isActive ? 'page' : undefined}
              className={navItemClasses}
            >
              <Icon className="nav-icon h-4 w-4 shrink-0" />
              {destination.label}
              {destination.intents.some(showNewDot) && (
                <span
                  data-testid={`${navTestId(destination.path)}-new-dot`}
                  className="bg-textEmphasis absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>
      {/* With the pill group hidden on mobile, ml-auto keeps the chip cluster
          pinned right (the DS Mobile / Topbar layout: logo · wallet · menu). */}
      <div className="desktop:ml-0 ml-auto flex items-center gap-3">
        <WalletChip />
        {import.meta.env.VITE_USE_MOCK_WALLET === 'true' && <MockConnectButton />}
        <MoreMenu />
      </div>
    </nav>
  );
}
