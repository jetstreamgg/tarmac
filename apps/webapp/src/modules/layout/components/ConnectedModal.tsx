import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t } from '@lingui/core/macro';
import { Close } from '@/modules/icons';
import { WalletCard } from '@jetstreamgg/sky-widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { WalletIcon } from '@/modules/ui/components/WalletIcon';
import { useConnection } from 'wagmi';
import { WALLET_ICONS } from '@/lib/constants';
import { ConnectedModalTabs } from './ConnectedModalTabs';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';

interface ConnectedModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ensName?: string | null;
  ensAvatar?: string | null;
  onDisconnect: () => void;
}

export function ConnectedModal({
  isOpen,
  onOpenChange,
  ensName,
  ensAvatar,
  onDisconnect
}: ConnectedModalProps) {
  const { onExternalLinkClicked } = useConfigContext();
  const { openConnectModal } = useConnectModal();
  const { connector } = useConnection();
  const [searchParams] = useSearchParams();
  const isSafeWallet = useIsSafeWallet();

  const onSwitchAccountClick = () => {
    onOpenChange(false);
    openConnectModal();
  };

  useEffect(() => {
    // Whenever there's a site navigation, close the connected modal
    onOpenChange(false);
  }, [searchParams]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-containerDark flex max-h-[calc(100dvh-32px)] flex-col gap-6 overflow-hidden p-4 sm:max-w-[490px] sm:min-w-[490px]"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-text text-2xl">{t`Account`}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0">
              <Close className="h-5 w-5" />
            </Button>
          </DialogClose>
        </div>

        <WalletCard
          className="mb-0"
          onSwitchAccountClick={onSwitchAccountClick}
          onExternalLinkClicked={onExternalLinkClicked}
          iconSize={40}
          showEns={true}
          ensName={ensName}
          ensAvatar={ensAvatar}
          walletIcon={
            connector && (
              <WalletIcon
                connector={connector}
                iconUrl={connector.icon || WALLET_ICONS[connector.id as keyof typeof WALLET_ICONS]}
                className="h-3.5 w-3.5"
              />
            )
          }
        />

        {!isSafeWallet && (
          <Button
            variant="primary"
            onClick={onDisconnect}
            size="large"
            className="text-md w-full px-6 leading-6"
          >
            {t`Disconnect wallet`}
          </Button>
        )}

        <ConnectedModalTabs />
      </DialogContent>
    </Dialog>
  );
}
