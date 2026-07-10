import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { ChevronDown } from 'lucide-react';
import { useConnection, useDisconnect, useEnsAvatar, useEnsName } from 'wagmi';
import { mainnet } from 'viem/chains';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { TermsModal } from '@/modules/ui/components/TermsModal';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '@/modules/auth/components/UnauthorizedPage';
import { useIsSafeWallet } from '@/hooks';
import { WalletPreviewDrawer } from './WalletPreviewDrawer';

const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/** V2 wallet chip: unauthorized page / terms modal / connect / chip with preview drawer. */
export function WalletChip() {
  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useConnection();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName!, chainId: mainnet.id });
  const isSafeWallet = useIsSafeWallet();
  const [showDrawer, setShowDrawer] = useState(false);
  const { isConnectedAndAcceptedTerms, isAuthorized, authData, vpnData } = useConnectedContext();

  const connectButton = (
    <Button variant="connect" onClick={openConnectModal}>
      {t`Connect Wallet`}
    </Button>
  );

  return (
    <div data-testid="wallet-chip">
      {!isAuthorized ? (
        <UnauthorizedPage authData={authData} vpnData={vpnData}>
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
            data-state={showDrawer ? 'open' : 'closed'}
            onClick={() => setShowDrawer(true)}
          >
            <CustomAvatar address={address} size={24} />
            <Text className="hidden sm:inline">{`${isSafeWallet ? 'safe:' : ''}${ensName || formatAddress(address)}`}</Text>
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
