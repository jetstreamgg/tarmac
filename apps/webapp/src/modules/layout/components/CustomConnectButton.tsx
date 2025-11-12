import { TermsModal } from '../../ui/components/TermsModal';
import { useAccount, useDisconnect, useEnsName, useEnsAvatar } from 'wagmi';
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

export function CustomConnectButton() {
  const { openConnectModal } = useConnectModal();
  const { isConnected, address, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! });
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
  ) : isSafeWallet && !!address && isConnected ? (
    <Button variant="connect" disabled className="disabled:text-text text-base">
      <div className="flex items-center gap-2">
        <CustomAvatar address={address || ''} size={24} />
        {`safe:${formatAddress(address)}`}
      </div>
    </Button>
  ) : isConnected && address ? (
    <>
      <Button variant="connect" onClick={() => setShowAccountMenu(true)} className="flex items-center gap-2">
        <CustomAvatar address={address} size={24} />
        <Text className="hidden sm:inline">
          {ensName ? `${ensName} (${formatAddress(address)})` : formatAddress(address)}
        </Text>
        <ChevronDown className="h-4 w-4" />
      </Button>

      <ConnectedModal
        isOpen={showAccountMenu}
        onOpenChange={setShowAccountMenu}
        address={address}
        ensName={ensName}
        ensAvatar={ensAvatar}
        connectorName={connector?.name}
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
