import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Cookie, FileText, FileWarning, Shield, SquareArrowUp, X } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { buttonVariants } from '@/components/ui/button';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { BATCH_TX_ENABLED } from '@/lib/constants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BatchTransactionsToggle } from '@/components/BatchTransactionsToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletChip } from './WalletChip';
import { MockConnectButton } from '@/modules/layout/components/MockConnectButton';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';
import { POSTHOG_ENABLED } from '@/modules/analytics/PostHogProvider';
import { useUpgradeModal } from '@/modules/upgrade/hooks/useUpgradeModal';
import { DESTINATIONS, navTestId, useActiveDestinationPath, useDestinationLinkProps } from './destinations';

// Design-system Button / Navbar (Figma 5010:29059, Default type); active
// styling keys off the link's aria-current="page".
// cn(), not the bare recipe: the base cva class carries `rounded-xl` and the
// navbar size overrides it with `rounded-full`. cva only concatenates, so
// without tailwind-merge collapsing that pair the pills take whichever radius
// the stylesheet happens to emit last.
const navItemClasses = cn(buttonVariants({ variant: 'navbar', size: 'navbar' }));

// Menu dropdown row (Figma 5069:27509): 16px glyph + label on fg-primary,
// 8px apart; rows sit bare on the panel (no pill/tint). The M4.5 mobile panel
// (536:26429) steps the label up to 16/18 (Label 4); the desktop popover
// keeps 14/16 (Label 5) from md up — the same cutoff that swaps the surface.
const moreItemClasses =
  'text-fgPrimary hover:text-fgSecondary font-circle flex items-center gap-2 text-left text-base leading-[18px] font-medium tracking-[-0.32px] transition-colors md:text-sm md:leading-4 md:tracking-[-0.28px]';

// Env-driven legal links pick their DS glyph by name (User Risk Documentation /
// Terms of Use / Privacy Policy in the comp); anything else gets the document glyph.
function linkIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('risk')) return FileWarning;
  if (lower.includes('privacy')) return Shield;
  return FileText;
}

/**
 * Shared body of the More menu: bundling toggle + hairline, the Upgrade
 * DAI/MKR row in its own hairline-delimited section, then the theme toggle,
 * legal links and cookie row. `mobile` swaps the desktop row rhythm (20px
 * gaps) for the comp's 40px touch rows with 2px gaps (Figma 536:26429).
 */
function MoreMenuContent({ mobile, closeMenu }: { mobile?: boolean; closeMenu: () => void }) {
  const { showBanner } = useCookieConsent();
  const footerLinks = getFooterLinks();
  const { open: openUpgrade } = useUpgradeModal();

  return (
    <>
      {BATCH_TX_ENABLED && (
        <>
          <BatchTransactionsToggle />
          <div className="bg-glassBorder h-px w-full" />
        </>
      )}
      {/* Upgrade DAI/MKR (Figma 536:26429): its own section between hairlines.
          Closes the menu, then launches the shared transaction modal —
          `launch()` replaces an idle open modal; the provider's in-flight
          guard restores a pending one instead (APP-413). */}
      <button
        data-testid="nav-more-upgrade"
        onClick={() => {
          closeMenu();
          openUpgrade();
        }}
        className={cn(moreItemClasses, mobile && 'min-h-10')}
      >
        <SquareArrowUp size={16} className="text-fgBrand shrink-0" />
        <Trans>Upgrade DAI/MKR</Trans>
      </button>
      <div className="bg-glassBorder h-px w-full" />
      <div className={cn('flex flex-col', mobile ? 'gap-0.5 *:min-h-10' : 'gap-5')}>
        <ThemeToggle />
        {footerLinks.map(link => {
          const url = sanitizeUrl(link.url);
          if (!url) return null;
          const Icon = linkIcon(link.name);
          return (
            <ExternalLink key={url} href={url} showIcon={false} className={moreItemClasses}>
              {/* Single child: ExternalLink HStack-wraps element children, which
                  would swallow the anchor's gap and leave the glyph flush. */}
              <span className="flex items-center gap-2">
                <Icon size={16} className="text-fgBrand shrink-0" />
                {link.name}
              </span>
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
            <Cookie size={16} className="text-fgBrand shrink-0" />
            <Trans>Cookie settings</Trans>
          </button>
        )}
      </div>
    </>
  );
}

/** Secondary actions that don't earn a destination: toggles, legal links. */
function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = () => setIsOpen(false);
  const { bpi } = useBreakpointIndex();

  // Menu type of Button / Navbar: Radix supplies data-state=open for the
  // active recipe, and the same attribute folds the glyph hamburger → X
  // (Figma 2134:88604; the motion lives on `.nav-menu-icon` in globals.css).
  const trigger = <MenuToggleIcon />;
  // shrink-0: the trigger sits in the chip cluster's shrink chain (M2.2) and
  // must keep its 40px circle — the wallet chip is the only flexible member.
  const triggerClasses = cn(buttonVariants({ variant: 'navbar', size: 'navbar' }), 'w-10 shrink-0 px-0');

  // M4.5 (Figma 536:26429): below md the popover becomes a bottom-anchored
  // floating panel — 12px viewport insets (the DS in-situ inset), 24px radius,
  // its own More heading + 32px circular close. Same rows as the desktop
  // menu; the Dark mode row stays included (content parity — flagged on
  // APP-388).
  if (bpi < BP.md) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger data-testid="nav-more" aria-label="More" className={triggerClasses}>
          {trigger}
        </SheetTrigger>
        {/* light:bg-container — the 5% lavender surface disappears over the
            overlay-dimmed page, so the panel takes the opaque light container
            token (the "popovers read on the light page" elevation). */}
        <SheetContent
          side="bottom"
          hideCloseButton
          aria-describedby={undefined}
          className="bg-bgSecondary light:bg-container inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] flex flex-col gap-6 rounded-[24px] border-0 px-5 py-6 shadow-none backdrop-blur-[100px]"
        >
          <div className="flex items-center justify-between">
            <SheetTitle className="text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px]">
              <Trans>More</Trans>
            </SheetTitle>
            <SheetClose
              data-testid="nav-more-close"
              aria-label={t`Close menu`}
              className={cn(buttonVariants({ variant: 'secondary', size: 'iconS' }))}
            >
              <X aria-hidden />
            </SheetClose>
          </div>
          <MoreMenuContent mobile closeMenu={closeMenu} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger data-testid="nav-more" aria-label="More" className={triggerClasses}>
        {trigger}
      </PopoverTrigger>
      {/* Menu dropdown panel (Figma 5069:27495): 274px glass panel — bg-secondary
          over a 100px backdrop blur, 24px radius, 20px padding, 24px between
          sections with a hairline divider after the bundling block. */}
      {/* Motion (Figma 2134:88604): the panel grows out of its top-right
          anchor — 0.9 → 1 while sliding in 14px from the right and 20px from
          above, 300ms on quart — and leaves the same way. `animated={false}`
          drops the shared popover's zoom/slide pair so these utilities are
          the only animation on the element. */}
      <PopoverContent
        align="end"
        animated={false}
        className="bg-bgSecondary data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out flex w-[274px] origin-top-right flex-col gap-6 rounded-3xl p-5 shadow-none backdrop-blur-[100px]"
      >
        <MoreMenuContent closeMenu={closeMenu} />
      </PopoverContent>
    </Popover>
  );
}

/** Final 4-destination top navigation. */
export function TopNav() {
  const activePath = useActiveDestinationPath();
  const { searchForIntent, handleNavClick } = useDestinationLinkProps('header_nav');

  // At the desktop tier the nav box dissolves (display: contents) so the pill
  // group and chip cluster sit directly in the shell header's three-flank grid
  // (APP-415) — the nav landmark itself stays in the accessibility tree. Below
  // desktop it's the flex row of the DS Mobile / Topbar layout.
  return (
    <nav className="desktop:contents flex w-full min-w-0 items-center gap-3" data-testid="top-nav">
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
      {/* The pill group is the center `auto` track of the header grid, so it
          sits on the page content's center line regardless of how the logo and
          chip-cluster flanks differ in width. Below the desktop tier the
          destinations live in the bottom MobileNavbar instead (M2), so the
          pill group hides. */}
      <div className="desktop:flex hidden items-center gap-2">
        {DESTINATIONS.map(destination => {
          const isActive = activePath === destination.path;
          const Icon = destination.icon;
          return (
            <Link
              key={destination.path}
              to={destination.path}
              search={searchForIntent(destination.intents[0])}
              onClick={handleNavClick(destination.intents[0], destination.path)}
              data-testid={navTestId(destination.path)}
              aria-current={isActive ? 'page' : undefined}
              className={navItemClasses}
            >
              <Icon className="nav-icon h-4 w-4 shrink-0" />
              {destination.label}
            </Link>
          );
        })}
      </div>
      {/* With the pill group hidden on mobile, ml-auto keeps the chip cluster
          pinned right (the DS Mobile / Topbar layout: logo · wallet · menu).
          At desktop it's the right grid flank instead, pinned by justify-self.
          min-w-0 lets the wallet chip shrink-truncate below 340px instead of
          pushing the row past the viewport (M2.2); the desktop grid keeps
          min-width:auto so a long chip still nudges the pills (APP-415). */}
      <div className="desktop:ml-0 desktop:justify-self-end desktop:min-w-[auto] ml-auto flex min-w-0 items-center gap-3">
        <WalletChip />
        {import.meta.env.VITE_USE_MOCK_WALLET === 'true' && <MockConnectButton />}
        <MoreMenu />
      </div>
    </nav>
  );
}
