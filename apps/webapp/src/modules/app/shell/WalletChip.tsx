import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { ChevronDown } from 'lucide-react';
import { useConnection, useDisconnect, useEnsAvatar, useEnsName } from 'wagmi';
import { mainnet } from 'viem/chains';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { TermsModal } from '@/modules/ui/components/TermsModal';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '@/modules/auth/components/UnauthorizedPage';
import { useIsSafeWallet } from '@/hooks';
import { WalletPreviewDrawer } from './WalletPreviewDrawer';

const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
// Phone tier: 0x + first two hex chars + last four (0x00…C4A2) — short enough
// to fit the chip at 360px without ellipsis-truncating mid-glyph (APP-416).
const formatAddressShort = (addr: string) => `${addr.slice(0, 4)}…${addr.slice(-4)}`;

/** V2 wallet chip: unauthorized page / terms modal / connect / chip with preview drawer. */
export function WalletChip() {
  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useConnection();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName!, chainId: mainnet.id });
  const isSafeWallet = useIsSafeWallet();
  const [showDrawer, setShowDrawer] = useState(false);
  const {
    isConnectedAndAcceptedTerms,
    isAuthorized,
    authData,
    vpnData,
    accessBlockReason,
    retryAccessChecks
  } = useConnectedContext();

  // Connect type of Navbar Item / Wallet Info (Figma 5069:27086): the DS
  // primary button recipe at navbar height (40px, Label 5).
  const connectButton = (
    <Button variant="primary" size="m" onClick={openConnectModal}>
      {t`Connect Wallet`}
    </Button>
  );

  return (
    // min-w-0 continues the topbar's shrink chain (M2.2): below 340px the chip
    // gives up width instead of overflowing the viewport. Scoped off at the
    // desktop grid, where chip width intentionally squeezes the flanks (APP-415).
    <div data-testid="wallet-chip" className="desktop:min-w-[auto] min-w-0">
      {!isAuthorized ? (
        <UnauthorizedPage
          authData={authData}
          vpnData={vpnData}
          blockReason={accessBlockReason}
          onRetry={retryAccessChecks}
        >
          {connectButton}
        </UnauthorizedPage>
      ) : !isConnectedAndAcceptedTerms ? (
        <TermsModal />
      ) : !isConnected ? (
        connectButton
      ) : isConnected && !!address ? (
        <>
          {/* Wallet type of Button / Navbar (Figma 5010:29059): the drawer is
              not a Radix trigger, so data-state carries the open recipe and
              the chevron flip by hand. */}
          <Button
            variant="navbar"
            size="navbarWallet"
            className="desktop:max-w-none max-w-full"
            data-state={showDrawer ? 'open' : 'closed'}
            onClick={() => setShowDrawer(true)}
          >
            {/* Jazzicon's inline-sized div is shrinkable; the wrapper keeps the
                24px circle out of the chip's shrink chain (only the label gives). */}
            <span className="flex shrink-0">
              <CustomAvatar address={address} size={24} />
            </span>
            {/* DS Mobile / Topbar keeps the name at phone width; the cap stops
                long ENS names from squeezing the logo out at 360px. Addresses
                swap to the short trim there instead of ellipsis-truncating.
                A bare span, not <Text>: the whole navbar is Label 5 / Circular
                Medium (Figma 1036:189127) and navbarWallet already sets it —
                a Text variant would re-declare Graphik at 16px on top. */}
            <span className="max-w-24 min-w-0 truncate sm:max-w-none">
              {ensName ? (
                `${isSafeWallet ? 'safe:' : ''}${ensName}`
              ) : (
                <>
                  <span className="sm:hidden">{`${isSafeWallet ? 'safe:' : ''}${formatAddressShort(address)}`}</span>
                  <span className="hidden sm:inline">{`${isSafeWallet ? 'safe:' : ''}${formatAddress(address)}`}</span>
                </>
              )}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDrawer && 'rotate-180')} />
          </Button>
          <WalletPreviewDrawer
            isOpen={showDrawer}
            onOpenChange={setShowDrawer}
            ensName={ensName}
            ensAvatar={ensAvatar}
            onDisconnect={() => {
              disconnect();
              setShowDrawer(false);
            }}
          />
        </>
      ) : (
        connectButton
      )}
    </div>
  );
}
