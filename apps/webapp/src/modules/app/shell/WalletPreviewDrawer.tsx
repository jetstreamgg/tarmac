import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { t } from '@lingui/core/macro';
import { Button } from '@/components/ui/button';
import { useIsSafeWallet } from '@/hooks';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { WalletPreviewHeader } from './WalletPreviewHeader';
import { WalletDrawerTabs } from './WalletDrawerTabs';

interface WalletPreviewDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ensName?: string | null;
  ensAvatar?: string | null;
  onDisconnect: () => void;
}

/** V2 right slide-out wallet preview. Replaces ConnectedModal's Dialog for the V2 chip (legacy keeps its own until B4). */
export function WalletPreviewDrawer({
  isOpen,
  onOpenChange,
  ensName,
  ensAvatar,
  onDisconnect
}: WalletPreviewDrawerProps) {
  const locationHref = useRouterState({ select: s => s.location.href });
  const { openConnectModal } = useConnectModal();
  const isSafeWallet = useIsSafeWallet();

  useEffect(() => {
    // Same contract as ConnectedModal: any navigation closes the preview.
    onOpenChange(false);
  }, [locationHref, onOpenChange]);

  const onSwitchAccountClick = () => {
    onOpenChange(false);
    openConnectModal();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="wallet-drawer"
        aria-describedby={undefined}
        className="bg-containerDark border-borderPrimary flex w-full flex-col gap-6 overflow-hidden border-l p-4 sm:max-w-[440px]"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{t`Account`}</SheetTitle>
        <WalletPreviewHeader
          ensName={ensName}
          ensAvatar={ensAvatar}
          onSwitchAccountClick={onSwitchAccountClick}
        />
        {!isSafeWallet && (
          <Button
            variant="primary"
            size="large"
            onClick={onDisconnect}
            data-testid="wallet-drawer-disconnect"
            className="text-md w-full px-6 leading-6"
          >
            {t`Disconnect wallet`}
          </Button>
        )}
        <WalletDrawerTabs />
      </SheetContent>
    </Sheet>
  );
}
