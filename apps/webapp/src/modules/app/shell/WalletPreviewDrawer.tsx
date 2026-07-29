import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { ChevronsRight } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { t } from '@lingui/core/macro';
import { BP, useBreakpointIndex } from '@/hooks';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { WalletPreviewHeader } from './WalletPreviewHeader';
import { WalletDrawerTabs } from './WalletDrawerTabs';

/**
 * The frosted Sheet scrim is the mobile *modal* recipe (Figma 1292:63542), and
 * the wallet preview isn't one: its comp (Figma 1030:138710) has no overlay
 * node at all — the page reads sharp and undimmed right up to the panel edge.
 * The panel self-frosts (backdrop-blur-sm over an opaque/glass fill), so it
 * stays legible without a scrim. Kept as an element, transparent, so Radix
 * still gets its pointer blocker and dismiss target.
 */
const NO_SCRIM = 'bg-transparent backdrop-blur-none';

interface WalletPreviewDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ensName?: string | null;
  ensAvatar?: string | null;
  onDisconnect: () => void;
}

/**
 * V2 wallet preview opened from the wallet chip. At md+ it's the right
 * slide-out drawer: a floating rounded panel with a collapse rail, gradient
 * identity header and Assets/Activity tabs. Below md (Figma 536:26681, M4.6)
 * the same content presents as a bottom-anchored panel with 12px viewport
 * insets and a close button in the header instead of the rail.
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
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  useEffect(() => {
    // Any navigation closes the preview.
    onOpenChange(false);
  }, [locationHref, onOpenChange]);

  const onSwitchAccountClick = () => {
    onOpenChange(false);
    openConnectModal();
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        {/* The comp's panel hugs its content above a 12px bottom inset; the
            max-height (68px topbar + 12px inset each side) only bites when the
            Activity tab grows past the viewport and the tab panel scrolls. */}
        <SheetContent
          side="bottom"
          data-testid="wallet-drawer"
          aria-describedby={undefined}
          overlayClassName={NO_SCRIM}
          hideCloseButton
          className="bg-containerDark border-borderPrimary inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] h-auto max-h-[calc(100dvh-92px)] gap-0 overflow-hidden rounded-[28px] border p-0 backdrop-blur-sm"
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
        >
          <SheetTitle className="sr-only">{t`Account`}</SheetTitle>
          <WalletPreviewHeader
            mobile
            ensName={ensName}
            ensAvatar={ensAvatar}
            onSwitchAccountClick={onSwitchAccountClick}
            onDisconnect={onDisconnect}
          />
          {/* pr compensates the 10px scrollbar gutter reserved inside the tab
              panels; pl-3 + the panels' px-2 lands the comp's 20px inset. */}
          <div className="flex min-h-0 flex-1 flex-col pt-6 pr-0.5 pb-3 pl-3">
            <WalletDrawerTabs />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="wallet-drawer"
        aria-describedby={undefined}
        overlayClassName={NO_SCRIM}
        className="border-glassBorder bg-glassSurface inset-y-3 right-3 h-auto w-[calc(100%-24px)] flex-row gap-0 overflow-hidden rounded-[28px] border p-0 backdrop-blur-sm sm:max-w-[538px]"
        closeButtonClassName="hidden"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{t`Account`}</SheetTitle>
        <div className="hidden shrink-0 p-3 sm:block">
          <SheetClose
            data-testid="wallet-drawer-collapse"
            aria-label={t`Close`}
            className="text-text border-borderPrimary light:hover:bg-surfaceAlt flex size-10 items-center justify-center rounded-full border bg-gradient-to-b from-white/0 to-white/8 bg-origin-border transition-colors hover:bg-white/10"
          >
            <ChevronsRight className="size-4" />
          </SheetClose>
        </div>
        <div className="border-borderPrimary flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border">
          <WalletPreviewHeader
            ensName={ensName}
            ensAvatar={ensAvatar}
            onSwitchAccountClick={onSwitchAccountClick}
            onDisconnect={onDisconnect}
          />
          {/* pr compensates the 10px scrollbar gutter reserved inside the tab
              panels so left/right content insets stay visually equal. */}
          <div className="bg-containerDark flex min-h-0 flex-1 flex-col pt-7 pr-0.5 pb-3 pl-3">
            <WalletDrawerTabs />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
