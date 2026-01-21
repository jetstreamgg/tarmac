import { TermsModal } from '../../ui/components/TermsModal';
import { useConnection, useDisconnect, useEnsName, useEnsAvatar } from 'wagmi';
import { Button } from '@/components/ui/button';
import { t } from '@lingui/core/macro';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '../../auth/components/UnauthorizedPage';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ConnectedModal } from './ConnectedModal';
import { Text } from './Typography';
import { mainnet } from 'viem/chains';

export function CustomConnectButton() {
  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useConnection();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName!, chainId: mainnet.id });
  const isSafeWallet = useIsSafeWallet();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const { isConnectedAndAcceptedTerms, isAuthorized, authData, vpnData } = useConnectedContext();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isAuthorized) {
    return (
      <UnauthorizedPage authData={authData} vpnData={vpnData}>
        <Button variant="connect" onClick={openConnectModal}>
          {t`Connect Wallet`}
        </Button>
      </UnauthorizedPage>
    );
  }

  return !isConnectedAndAcceptedTerms ? (
    <TermsModal />
  ) : !isConnected ? (
    <Button variant="connect" onClick={openConnectModal}>
      {t`Connect Wallet`}
    </Button>
  ) : isConnected && !!address ? (
    <>
      <Button variant="connect" onClick={() => setShowAccountMenu(true)} className="flex items-center gap-2">
        <CustomAvatar address={address} size={24} />
        <Text className="hidden sm:inline">{`${isSafeWallet ? 'safe:' : ''}${ensName || formatAddress(address)}`}</Text>
        <ChevronDown className="h-4 w-4" />
      </Button>

      <ConnectedModal
        isOpen={showAccountMenu}
        onOpenChange={setShowAccountMenu}
        ensName={ensName}
        ensAvatar={ensAvatar}
        onDisconnect={() => {
          disconnect();
          setShowAccountMenu(false);
        }}
      />
    </>
  ) : (
    <Button variant="connect" onClick={openConnectModal}>
      {t`Connect Wallet`}
    </Button>
  );
}
