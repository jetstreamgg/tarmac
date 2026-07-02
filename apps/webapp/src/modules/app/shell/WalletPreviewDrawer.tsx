import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { ChevronsRight } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { t } from '@lingui/core/macro';
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

/**
 * V2 right slide-out wallet preview opened from the wallet chip: a floating
 * rounded panel with a collapse rail, gradient identity header and
 * Assets/Activity tabs.
 */
export function WalletPreviewDrawer({
  isOpen,
  onOpenChange,
  ensName,
  ensAvatar,
  onDisconnect
}: WalletPreviewDrawerProps) {
  const locationHref = useRouterState({ select: s => s.location.href });
  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    // Any navigation closes the preview.
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
        className="light:bg-[#1a1855]/5 light:border-[#1a1855]/15 inset-y-3 right-3 h-auto w-[calc(100%-24px)] flex-row gap-0 overflow-hidden rounded-[28px] border border-[#bcb6ef]/20 bg-[#bcb6ef]/5 p-0 backdrop-blur-sm sm:max-w-[538px]"
        closeButtonClassName="hidden"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{t`Account`}</SheetTitle>
        <div className="hidden shrink-0 p-3 sm:block">
          <SheetClose
            data-testid="wallet-drawer-collapse"
            aria-label={t`Close`}
            className="text-text light:border-[#1a1855]/15 light:hover:bg-[#1a1855]/5 flex size-10 items-center justify-center rounded-full border border-[#bcb6ef]/10 bg-gradient-to-b from-white/0 to-white/8 transition-colors hover:bg-white/10"
          >
            <ChevronsRight className="size-4" />
          </SheetClose>
        </div>
        <div className="light:border-[#1a1855]/10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#bcb6ef]/10">
          <WalletPreviewHeader
            ensName={ensName}
            ensAvatar={ensAvatar}
            onSwitchAccountClick={onSwitchAccountClick}
            onDisconnect={onDisconnect}
          />
          <div className="bg-containerDark flex min-h-0 flex-1 flex-col p-3 pt-7">
            <WalletDrawerTabs />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
