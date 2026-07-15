import { ComponentType, MouseEvent, ReactNode, useCallback, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useChainId, useChains } from 'wagmi';
import { Cookie, FileText, FileWarning, Menu, Shield, X } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { Convert, Earn, StakeSky, Wallet } from '@/modules/icons';
import { Intent } from '@/lib/enums';
import { BATCH_TX_ENABLED, QueryParams } from '@/lib/constants';
import { intentToPath, ROUTES, RoutePath } from '@/lib/routes';
import { AppRoutePath, retainOnNavigate, useRouteIntent } from '@/lib/navigation';
import { getNetworkOverrideForIntent } from '@/lib/widget-network-map';
import { useNewIntentDots } from '@/modules/app/hooks/useNewIntentDots';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BatchTransactionsToggle } from '@/components/BatchTransactionsToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletChip } from './WalletChip';
import { MockConnectButton } from '@/modules/layout/components/MockConnectButton';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';
import { POSTHOG_ENABLED } from '@/modules/analytics/PostHogProvider';

// Destination paths must be in the route map AND mounted as routes (B1 placeholders guarantee it).
type DestinationPath = Extract<AppRoutePath, RoutePath>;

type Destination = {
  path: DestinationPath;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
  // Modules the destination covers; the first is its landing module and
  // decides the network override for the link.
  intents: Intent[];
};

// The 4 target-IA destinations (plan §4.2). Paths come from ROUTES, never hardcoded.
const DESTINATIONS: Destination[] = [
  {
    path: ROUTES.PORTFOLIO,
    label: <Trans>Portfolio</Trans>,
    icon: Wallet,
    intents: [Intent.BALANCES_INTENT]
  },
  {
    path: ROUTES.EARN,
    label: <Trans>Earn</Trans>,
    icon: Earn,
    intents: [
      Intent.SAVINGS_INTENT,
      Intent.REWARDS_INTENT,
      Intent.VAULTS_INTENT,
      Intent.FIXED_INTENT,
      Intent.EXPERT_INTENT
    ]
  },
  { path: ROUTES.STAKE, label: <Trans>Stake SKY</Trans>, icon: StakeSky, intents: [Intent.STAKE_INTENT] },
  {
    path: ROUTES.CONVERT,
    label: <Trans>Convert</Trans>,
    icon: Convert,
    intents: [Intent.CONVERT_INTENT, Intent.TRADE_INTENT, Intent.UPGRADE_INTENT]
  }
];

const navTestId = (path: RoutePath) => `nav-${path.slice(1)}`;

const isUnderDestination = (path: string, base: RoutePath) => path === base || path.startsWith(`${base}/`);

// Active destination: the current path when it sits under a destination, else
// the destination owning the route's intent (covers Balances at / → Portfolio).
function useActiveDestinationPath(): RoutePath | null {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const routeIntent = useRouteIntent();
  const byPath = DESTINATIONS.find(d => isUnderDestination(pathname, d.path));
  if (byPath) return byPath.path;
  const intentPath = intentToPath(routeIntent);
  return DESTINATIONS.find(d => isUnderDestination(intentPath, d.path))?.path ?? null;
}

// Design-system Button / Navbar (Figma 5010:29059, Default type); active
// styling keys off the link's aria-current="page".
const navItemClasses = cn(buttonVariants({ variant: 'navbar', size: 'navbar' }), 'relative');

// Menu dropdown row (Figma 5069:27509): 16px glyph + Label 5 on fg-primary,
// 8px apart; rows sit bare on the panel (no pill/tint), 20px between them.
const moreItemClasses =
  'text-fgPrimary hover:text-fgSecondary font-circle flex items-center gap-2 text-left text-sm leading-4 font-medium tracking-[-0.28px] transition-colors';

// Env-driven legal links pick their DS glyph by name (User Risk Documentation /
// Terms of Use / Privacy Policy in the comp); anything else gets the document glyph.
function linkIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('risk')) return FileWarning;
  if (lower.includes('privacy')) return Shield;
  return FileText;
}

/** Secondary actions that don't earn a destination: toggles, legal links. */
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
      {/* Menu dropdown panel (Figma 5069:27495): 274px glass panel — bg-secondary
          over a 100px backdrop blur, 24px radius, 20px padding, 24px between
          sections with a hairline divider after the bundling block. The comp's
          Upgrade DAI/MKR row is omitted: the upgrade surface is parked (E2). */}
      <PopoverContent
        align="end"
        className="bg-bgSecondary flex w-[274px] flex-col gap-6 rounded-3xl p-5 shadow-none backdrop-blur-[100px]"
      >
        {BATCH_TX_ENABLED && (
          <>
            <BatchTransactionsToggle />
            <div className="bg-glassBorder h-px w-full" />
          </>
        )}
        <div className="flex flex-col gap-5">
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
      </PopoverContent>
    </Popover>
  );
}

/** Final 4-destination top navigation. */
export function TopNav() {
  const activePath = useActiveDestinationPath();
  const chainId = useChainId();
  const chains = useChains();
  const { showNewDot } = useNewIntentDots();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();

  // Same semantics as the legacy nav: mainnet-only destinations carry the
  // network switch in the href itself (cmd-click and copy-link included).
  const searchForIntent = useCallback(
    (targetIntent: Intent) => (prev: Record<string, string | undefined>) => {
      const retained = retainOnNavigate(prev);
      const override = getNetworkOverrideForIntent(targetIntent, chainId, chains);
      if (override) retained[QueryParams.Network] = override;
      return retained;
    },
    [chainId, chains]
  );

  // Modified clicks open a new tab; this tab doesn't navigate, so skip the
  // switching feedback. No analytics here: nav events are pending sign-off (B1 ships none).
  const handleNavClick = useCallback(
    (targetIntent: Intent) => (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (getNetworkOverrideForIntent(targetIntent, chainId, chains)) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
      }
    },
    [chainId, chains, setIsSwitchingNetwork, setIsAutoSwitching]
  );

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
      {/* mx-auto centers the pill group between the logo (left, in Layout) and the chip cluster. */}
      <div className="mx-auto flex items-center gap-2">
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
      <WalletChip />
      {import.meta.env.VITE_USE_MOCK_WALLET === 'true' && <MockConnectButton />}
      <MoreMenu />
    </nav>
  );
}
