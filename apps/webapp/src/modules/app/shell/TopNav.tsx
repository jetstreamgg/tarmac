import { ComponentType, MouseEvent, ReactNode, useCallback, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useChainId } from 'wagmi';
import { Menu, X } from 'lucide-react';
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

const moreItemClasses =
  'text-textSecondary hover:text-text hover:bg-bgHover rounded-md px-3 py-2 text-left text-sm transition-colors';

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
        {isOpen ? <X size={16} /> : <Menu size={16} />}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col gap-1 p-2">
        <div className="flex items-center gap-1 px-1">
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
  const chainId = useChainId();
  const { showNewDot } = useNewIntentDots();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();

  // Same semantics as the legacy nav: mainnet-only destinations carry the
  // network switch in the href itself (cmd-click and copy-link included).
  const searchForIntent = useCallback(
    (targetIntent: Intent) => (prev: Record<string, string | undefined>) => {
      const retained = retainOnNavigate(prev);
      const override = getNetworkOverrideForIntent(targetIntent, chainId);
      if (override) retained[QueryParams.Network] = override;
      return retained;
    },
    [chainId]
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
      if (getNetworkOverrideForIntent(targetIntent, chainId)) {
        setIsSwitchingNetwork(true);
        setIsAutoSwitching(true);
      }
    },
    [chainId, setIsSwitchingNetwork, setIsAutoSwitching]
  );

  return (
    <nav className="flex w-full items-center gap-3" data-testid="top-nav">
      {/* Shared gradient for the selected nav icon (dark mode); referenced by
          fill: url(#nav-icon-gradient) in globals.css. */}
      <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
        <defs>
          <linearGradient
            id="nav-icon-gradient"
            x1="12"
            y1="0"
            x2="12"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F7A7F9" />
            <stop offset="1" stopColor="#9583FF" />
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
