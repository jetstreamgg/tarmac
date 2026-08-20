import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useConnect,
  useConnectors,
  Connector,
  useConnection,
  useSwitchConnection,
  useConnections
} from 'wagmi';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListWallet } from '@/components/ui/list';
import { cn } from '@/lib/cn';
import { Text } from '@/modules/layout/components/Typography';
import { Close } from '@/modules/icons';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { getFooterLinks, sanitizeUrl } from '@/lib/utils';
import { useIsSafeWallet } from '@/hooks';
import { WalletIcon } from './WalletIcon';
import { WALLET_ICONS } from '@/lib/constants';
import { reportError } from '@/modules/sentry/reportError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The modal is a two-level drill-down inside one card (Figma 2376:226069 →
 * reference flow 1142:44341): the root lists the wallets the visitor is most
 * likely to reach for, and a "Search wallet · +N" row swaps the card's body for
 * a searchable list of everything else.
 */
type ConnectView = 'root' | 'all';

/**
 * Non-injected connectors that stay on the root level rather than moving into
 * the sublist. WalletConnect is the universal fallback the comp draws there;
 * Safe only ever appears inside a Safe app, where burying it would strand the
 * one connector that can work.
 */
const ROOT_OTHER_WALLET_IDS = ['walletConnect', 'safe'];

/** Height of the sublist's scroll viewport (Figma 1142:44375), so the card
 *  stays the same size whichever level is showing. */
const SUBLIST_VIEWPORT = 'h-[258px]';

// Detectors for in-page wallet SDK modals that may overlay our own Dialog.
// Each detector knows the element selector AND how to tell whether the modal
// is currently open — needed because Reown AppKit keeps `<w3m-modal>` mounted
// at all times and only toggles a `class="open"` (via `:host(.open)` CSS in
// its shadow DOM) to show/hide the actual content. MetaMask Connect and
// Binance, by contrast, add and remove their modal elements from the DOM
// per-flow.
//
// Add new entries as we adopt new connectors that ship a document.body-mounted
// modal. Extension popups, mobile deep links, and window.open popups (Coinbase
// Wallet, Base Account) do not render an in-page modal and don't need to be
// listed.
const WALLET_OVERLAY_DETECTORS: { selector: string; isOpen: (el: Element) => boolean }[] = [
  // MetaMask Connect — modal element is added/removed per-flow, existence = open.
  { selector: 'mm-install-modal', isOpen: () => true },
  { selector: 'mm-otp-modal', isOpen: () => true },
  // Reown / WalletConnect AppKit — element stays mounted, signals open via class.
  { selector: 'wcm-modal', isOpen: el => el.classList.contains('open') },
  { selector: 'w3m-modal', isOpen: el => el.classList.contains('open') },
  { selector: 'appkit-modal', isOpen: el => el.classList.contains('open') },
  // Binance Web3 Wallet — wrapper div added/removed per-flow, existence = open.
  { selector: '#binanceW3W-wrapper', isOpen: () => true }
];

function isWalletOverlayVisible(): boolean {
  for (const { selector, isOpen } of WALLET_OVERLAY_DETECTORS) {
    const el = document.querySelector(selector);
    if (el && isOpen(el)) return true;
  }
  return false;
}

/**
 * One legal link in the terms line, resolved by name out of the env-driven
 * footer links so the modal can't drift from the nav's legal rows. Renders the
 * bare name when the deployment ships no matching link (the env var is
 * optional, and a dead link would be worse than plain text).
 */
function LegalLink({ name }: { name: string }) {
  const href = getFooterLinks().find(link => link.name === name)?.url;
  if (!href) return <>{name}</>;
  return (
    <a href={sanitizeUrl(href)} target="_blank" rel="noreferrer" className="text-fgBrand hover:underline">
      {name}
    </a>
  );
}

/**
 * The root's overflow row (Figma 2376:226069): the same List / Wallet geometry
 * as a connector row, with a glyph chip instead of a wallet mark and the count
 * of what sits behind it instead of a badge.
 */
function SearchWalletRow({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="connect-modal-search-wallet"
      className="border-borderPrimary hover:border-borderTertiary flex w-full items-center justify-between overflow-hidden rounded-2xl border p-4 text-left transition-colors"
    >
      <span className="flex min-w-0 items-center gap-3">
        {/* Figma types the chip colors/bg/bg-quarternary; the app's nearest
            background token is bg-tertiary, a step lighter at this size. */}
        <span className="bg-bgTertiary flex size-6 shrink-0 items-center justify-center rounded-lg">
          <Search aria-hidden className="text-fgPrimary size-3" />
        </span>
        <span className="font-circle text-fgPrimary truncate text-sm leading-4 font-medium tracking-[-0.28px]">
          {t`Search wallet`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-fgSecondary font-graphik text-sm leading-[22px]">{`+${count}`}</span>
        <ChevronRight aria-hidden className="text-fgQuaternary size-4 shrink-0" />
      </span>
    </button>
  );
}

/**
 * The sublist's filter field (Figma 1142:44374): an underline-only row — glyph,
 * input, and a rule that takes the brand gradient once something is typed.
 */
function WalletSearchInput({
  value,
  onChange,
  count
}: {
  value: string;
  onChange: (value: string) => void;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Search aria-hidden className="text-fgSecondary size-4 shrink-0" />
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={t`Search wallets`}
          data-testid="connect-modal-search-input"
          placeholder={t`Search through ${count} wallets`}
          className="text-fgPrimary placeholder:text-fgTertiary font-graphik w-full bg-transparent text-sm leading-[22px] outline-hidden"
        />
      </div>
      <span
        className={cn(
          'h-px w-full',
          value ? 'from-brand3-start to-brand3-end bg-linear-to-r' : 'bg-borderPrimary'
        )}
      />
    </div>
  );
}

/**
 * Fixed-height scroll viewport for the sublist, with the comp's bottom scrim
 * (Figma 1142:44391) fading the last rows out — masked, not overlaid, so it
 * works on the glass card without painting a colour over it. The fade only
 * shows while there is more list below, so a short (or fully scrolled) list
 * isn't dimmed for nothing.
 */
function FadingScrollList({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [faded, setFaded] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: fractional layout can leave scrollTop a hair short of the
    // bottom, which would keep the scrim up over nothing.
    setFaded(el.scrollHeight - el.clientHeight - el.scrollTop > 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Rows are children, so the viewport's own box may not change when the
    // filtered list does — watch the content too.
    Array.from(el.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <div
      ref={ref}
      onScroll={measure}
      data-testid="connect-modal-wallet-list"
      className={cn('flex flex-col gap-2 overflow-y-auto', faded && 'mask-b-from-70%', className)}
    >
      {children}
    </div>
  );
}

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
  const connectors = useConnectors();
  const { connector: connectedConnector } = useConnection();
  const connections = useConnections();

  const isSafeWallet = useIsSafeWallet();
  const { trackWalletConnectAttempted, trackWalletConnectRejected } = useAppAnalytics();

  const connect = useConnect({
    mutation: {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (error, variables) => {
        if (isUserRejectedRequestError(error)) {
          // Otherwise swallowed silently — the funnel needs the drop-off (APP-444 C3).
          trackWalletConnectRejected({
            connectorName: (variables.connector as Connector)?.name ?? 'unknown',
            method: 'connect'
          });
          return;
        }

        reportError(error, {
          module: 'auth',
          flow: 'wallet-connect',
          action: 'connect',
          type: 'wallet_connection_error'
        });
      }
    }
  });
  const switchConnection = useSwitchConnection({
    mutation: {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (error, variables) => {
        if (isUserRejectedRequestError(error)) {
          trackWalletConnectRejected({
            connectorName: (variables.connector as Connector)?.name ?? 'unknown',
            method: 'switch'
          });
          return;
        }

        reportError(error, {
          module: 'auth',
          flow: 'wallet-connect',
          action: 'switch-connection',
          type: 'wallet_connection_error'
        });
      }
    }
  });
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if each connector is ready and get icons
    if (!open) return; // Only check when modal is open

    connectors.forEach(async connector => {
      try {
        // For injected wallets, check if provider is available
        // Injected wallets have type 'injected' or contain 'injected' in their id
        const isInjectedType =
          connector.type === 'injected' ||
          connector.id.toLowerCase().includes('metamask') ||
          connector.id.toLowerCase().includes('injected');

        if (isInjectedType) {
          // For injected wallets, check if provider exists
          const provider = await connector.getProvider();
          setReady(prev => ({ ...prev, [connector.uid]: !!provider }));
        } else {
          // Non-injected wallets (WalletConnect, Coinbase, etc) are always "ready"
          // They work via QR/deep links
          setReady(prev => ({ ...prev, [connector.uid]: true }));
        }

        // Try to get the connector's icon
        setIcons(prev => ({
          ...prev,
          [connector.uid]: connector.icon || WALLET_ICONS[connector.id as keyof typeof WALLET_ICONS] || ''
        }));
      } catch (err) {
        console.warn(`Connector ${connector.name} not available:`, err);
        setReady(prev => ({ ...prev, [connector.uid]: false }));
      }
    });
  }, [connectors, open]);

  // Categorize wallets
  const alwaysAvailable = ['walletConnect', 'coinbaseWalletSDK', 'baseAccount', 'safe', 'wallet.binance.com'];
  const suggestedIds = [
    'metaMask',
    'baseAccount',
    'coinbaseWalletSDK',
    'walletConnect',
    'wallet.binance.com',
    'safe'
  ];

  // Binance wallet has two IDs:
  // - 'wallet.binance.com': our imported connector
  // - 'com.binance.wallet': EIP-6963 ID from the browser extension (auto-discovered)
  const isBinanceInjectedDetected = connectors.some(
    c => c.id === 'com.binance.wallet' && ready[c.uid] === true
  );

  // Separate installed wallets from suggested
  const installedWallets = connectors.filter(c => {
    // Don't show Safe wallet if not in Safe context
    if (c.id === 'safe' && !isSafeWallet) return false;
    // Don't show our Binance connector in installed wallets (it's for suggested only)
    if (c.id === 'wallet.binance.com') return false;

    // Only show injected wallets that are detected
    const isInjectedType =
      c.type === 'injected' ||
      c.id.toLowerCase().includes('metamask') ||
      c.id.toLowerCase().includes('injected');

    // Must be injected type AND ready (detected)
    return isInjectedType && ready[c.uid] === true;
  });

  const suggestedWallets = connectors.filter(c => {
    // Don't show Safe wallet if not in Safe context
    if (c.id === 'safe' && !isSafeWallet) return false;

    // Check if this wallet is already in installedWallets
    const isAlreadyInstalled = installedWallets.some(installed => installed.uid === c.uid);
    if (isAlreadyInstalled) return false;

    // Don't show Binance connector if injected Binance is already installed
    if (c.id === 'wallet.binance.com' && isBinanceInjectedDetected) return false;

    // Include if it's both suggested AND always available (QR/universal wallets)
    if (suggestedIds.includes(c.id) && alwaysAvailable.includes(c.id)) return true;

    return false;
  });

  // "Other wallets" keeps only the connectors listed above; the rest sit behind
  // the root's "Search wallet" row.
  const rootOtherWallets = suggestedWallets.filter(c => ROOT_OTHER_WALLET_IDS.includes(c.id));
  const sublistWallets = suggestedWallets.filter(c => !ROOT_OTHER_WALLET_IDS.includes(c.id));

  // Rows are the design-system List / Wallet (Figma 5209:38238): the whole
  // row is the connect button. The legacy "Connecting..." subtitle maps to the
  // active (loader) state; "Connected" and "Connect via QR" move into the
  // Label 6 badge slot ("Recent" in Figma — we don't track recency).
  const renderConnectorButton = (connector: Connector) => {
    const isConnecting =
      (connect.isPending && connect.variables?.connector === connector) ||
      (switchConnection.isPending && switchConnection.variables?.connector === connector);
    const isReady = ready[connector.uid] ?? false;
    const isConnectorConnected = !!connections.find(c => c.connector.uid === connector.uid);
    const isCurrentConnectedConnector = connectedConnector?.uid === connector.uid;

    return (
      <ListWallet
        key={connector.uid}
        icon={<WalletIcon connector={connector} iconUrl={icons[connector.uid]} className="h-6 w-6" />}
        name={connector.name}
        badge={
          isCurrentConnectedConnector
            ? t`Connected`
            : !isReady && !isConnecting && alwaysAvailable.includes(connector.id)
              ? t`Connect via QR`
              : undefined
        }
        active={isConnecting}
        onClick={() => {
          trackWalletConnectAttempted({
            connectorName: connector.name,
            method: isConnectorConnected ? 'switch' : 'connect'
          });
          if (isConnectorConnected) {
            switchConnection.switchConnection({ connector });
          } else {
            connect.connect({ connector });
          }
        }}
        disabled={!isReady || connect.isPending || switchConnection.isPending || isCurrentConnectedConnector}
      />
    );
  };

  // Wallet SDKs that render their own modal (MetaMask Connect, WalletConnect)
  // mount it as a sibling of our Radix Dialog under document.body. With Radix
  // in modal mode, DismissableLayer globally blocks outside pointer events, so
  // clicks meant for the SDK modal get swallowed. Rather than fight Radix, we
  // close our own Dialog while a known SDK modal is on screen and reopen it
  // when the SDK modal goes away. Flows that don't render an in-page modal
  // (browser extensions, mobile deep links, popup windows for Coinbase/Base)
  // don't trigger this — our Dialog stays open through them.
  const [hasWalletOverlay, setHasWalletOverlay] = useState(false);

  const [view, setView] = useState<ConnectView>('root');
  const [query, setQuery] = useState('');

  // A reopened modal always starts at the root — a stale drill-down (or a stale
  // query) would be the first thing the next visitor sees.
  useEffect(() => {
    if (!open) {
      setView('root');
      setQuery('');
    }
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSublist = normalizedQuery
    ? sublistWallets.filter(c => c.name.toLowerCase().includes(normalizedQuery))
    : sublistWallets;

  useEffect(() => {
    if (!open) {
      setHasWalletOverlay(false);
      return;
    }

    const check = () => setHasWalletOverlay(isWalletOverlayVisible());

    check();
    // Watch DOM mounts AND attribute changes — Reown AppKit reuses its modal
    // element and toggles visibility via attributes/CSS rather than removal.
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'data-state', 'class', 'style', 'aria-hidden']
    });
    return () => observer.disconnect();
  }, [open]);

  return (
    <Dialog open={open && !hasWalletOverlay} onOpenChange={onOpenChange}>
      {/* Modal Content per the latest comp (1030:60253, APP-443 item 18): a
          32px-inset column, 32px between blocks — title row, the wallet lists,
          then the terms line. The illustration + "Connect to explore Sky
          Protocol features" block the comp no longer draws is gone. */}
      <DialogContent
        aria-describedby={undefined}
        // app-loader-cover-hidden: keeps this dialog's exit animation from
        // flashing over the app loader cover a first connect arms (APP-515).
        // Surface is colors/bg/bg-secondary, the near-transparent lavender tint
        // every other DS modal card takes (Figma 2376:226058, "Wrong background
        // color"); the frosting comes from DialogOverlay's blur-full scrim, so
        // the opaque containerDark it used to paint hid it.
        className="app-loader-cover-hidden bg-bgSecondary max-h-[calc(100dvh-32px)] gap-8 overflow-auto p-8 sm:max-w-[490px] sm:min-w-[490px]"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Drilling in adds a back control and keeps the same title, so the
                card never looks like a different modal (Figma 1142:44365). */}
            {view === 'all' && (
              <Button
                variant="secondary"
                size="iconM"
                aria-label={t`Back`}
                data-testid="connect-modal-back"
                onClick={() => setView('root')}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
            )}
            {/* Label 3 (Circular 18/22, -0.36) — it was a 24px heading. */}
            <DialogTitle className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
              {t`Connect a wallet`}
            </DialogTitle>
          </div>
          {/* DS Button / Icon, secondary at 40px. */}
          <DialogClose asChild>
            <Button variant="secondary" size="iconM" data-testid="connect-modal-close">
              <Close aria-hidden />
            </Button>
          </DialogClose>
        </div>

        {view === 'root' ? (
          <div className="flex flex-col gap-8">
            {installedWallets.length > 0 && (
              // Section labels are the pattern's Body 6 fg-secondary list titles (Figma 5209:38849).
              <div className="flex flex-col gap-2">
                <Text className="text-fgSecondary text-xs leading-[18px]">{t`Connect with`}</Text>
                {installedWallets.map(renderConnectorButton)}
              </div>
            )}

            {(rootOtherWallets.length > 0 || sublistWallets.length > 0) && (
              <div className="flex flex-col gap-2">
                <Text className="text-fgSecondary text-xs leading-[18px]">{t`Other wallets`}</Text>
                {rootOtherWallets.map(renderConnectorButton)}
                {sublistWallets.length > 0 && (
                  <SearchWalletRow
                    count={sublistWallets.length}
                    onClick={() => {
                      setQuery('');
                      setView('all');
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <WalletSearchInput value={query} onChange={setQuery} count={sublistWallets.length} />
            <FadingScrollList className={SUBLIST_VIEWPORT}>
              {filteredSublist.length > 0 ? (
                filteredSublist.map(renderConnectorButton)
              ) : (
                <Text className="text-fgSecondary py-4 text-center text-xs leading-[18px]">
                  {t`No wallets match your search`}
                </Text>
              )}
            </FadingScrollList>
          </div>
        )}

        {/* The comp closes on the terms line, centred under the lists — it used
            to sit between them, only appeared when a wallet was installed, and
            named the terms without linking them.

            The comp writes "Terms of Service"; this says "Terms of Use", which
            is what the document it points at is actually called and what every
            other surface in the app calls it. Both URLs come from
            VITE_FOOTER_LINKS (the same source as the nav's legal rows) rather
            than being hardcoded here. */}
        <Text className="text-fgSecondary text-center text-xs leading-[18px]">
          <Trans>
            By connecting a wallet, you agree to Sky&apos;s <LegalLink name="Terms of Use" /> and acknowledge
            its <LegalLink name="Privacy Policy" />.
          </Trans>
        </Text>

        {(connect.error || switchConnection.error) && (
          <Text className="text-sm text-red-500">{t`Failed to connect. Please try again.`}</Text>
        )}
      </DialogContent>
    </Dialog>
  );
}
