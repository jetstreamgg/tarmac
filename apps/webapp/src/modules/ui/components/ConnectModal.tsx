import { useState, useEffect } from 'react';
import {
  useConnect,
  useConnectors,
  Connector,
  useConnection,
  useSwitchConnection,
  useConnections
} from 'wagmi';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListWallet } from '@/components/ui/list';
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

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
  const connectors = useConnectors();
  const { connector: connectedConnector } = useConnection();
  const connections = useConnections();

  const isSafeWallet = useIsSafeWallet();

  const connect = useConnect({
    mutation: {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: error => {
        if (isUserRejectedRequestError(error)) return;

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
      onError: error => {
        if (isUserRejectedRequestError(error)) return;

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
        onClick={() =>
          isConnectorConnected
            ? switchConnection.switchConnection({ connector })
            : connect.connect({ connector })
        }
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
        className="bg-containerDark max-h-[calc(100dvh-32px)] gap-8 overflow-auto p-8 sm:max-w-[490px] sm:min-w-[490px]"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Label 3 (Circular 18/22, -0.36) — it was a 24px heading. */}
          <DialogTitle className="text-fgPrimary font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
            {t`Connect a wallet`}
          </DialogTitle>
          {/* DS Button / Icon, secondary at 40px. */}
          <DialogClose asChild>
            <Button variant="secondary" size="iconM" data-testid="connect-modal-close">
              <Close aria-hidden />
            </Button>
          </DialogClose>
        </div>

        <div className="flex flex-col gap-8">
          {installedWallets.length > 0 && (
            // Section labels are the pattern's Body 6 fg-secondary list titles (Figma 5209:38849).
            <div className="flex flex-col gap-2">
              <Text className="text-fgSecondary text-xs leading-[18px]">{t`Connect with`}</Text>
              {installedWallets.map(renderConnectorButton)}
            </div>
          )}

          {suggestedWallets.length > 0 && (
            <div className="flex flex-col gap-2">
              <Text className="text-fgSecondary text-xs leading-[18px]">{t`Other wallets`}</Text>
              {suggestedWallets.map(renderConnectorButton)}
            </div>
          )}
        </div>

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
