import { TermsModal } from '../../ui/components/TermsModal';
import { useAccount, useDisconnect, useEnsName, useEnsAvatar } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { t } from '@lingui/core/macro';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '../../auth/components/UnauthorizedPage';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Text } from '@/modules/layout/components/Typography';

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
        <span className="text-text hidden sm:inline">
          {ensName ? `${ensName} (${formatAddress(address)})` : formatAddress(address)}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      <Dialog open={showAccountMenu} onOpenChange={setShowAccountMenu}>
        <DialogContent className="bg-containerDark p-0 sm:max-w-[400px]">
          <div className="border-borderPrimary flex items-center justify-between border-b px-6 py-5">
            <DialogTitle>
              <Text className="text-text text-xl font-semibold">{t`Account`}</Text>
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0">
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>

          <div className="p-6">
            <div className="mb-6 flex flex-col items-center gap-4">
              {ensAvatar ? (
                <img alt="ENS Avatar" className="h-20 w-20 rounded-full" src={ensAvatar} />
              ) : (
                <CustomAvatar address={address} size={80} />
              )}
              <div className="text-center">
                <div className="text-text text-lg font-medium">{ensName || formatAddress(address)}</div>
                {ensName && <div className="text-textSecondary mt-1 text-sm">{formatAddress(address)}</div>}
                <div className="text-textSecondary mt-2 text-sm">Connected with {connector?.name}</div>
              </div>
            </div>

            <Button
              variant="connect"
              onClick={() => {
                disconnect();
                setShowAccountMenu(false);
              }}
              className="w-full"
            >
              {t`Disconnect Wallet`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  ) : (
    <Button variant="connect" onClick={openConnectModal}>
      {t`Connect Wallet`}
    </Button>
  );
}
