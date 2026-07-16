import { ReactNode } from 'react';
import { useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { ArrowLeftRight, Unlink, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsSafeWallet } from '@/hooks';
import { WALLET_ICONS } from '@/lib/constants';
import { formatUsd } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { WalletIcon } from '@/modules/ui/components/WalletIcon';
import { CopyToClipboard } from '@/widgets/shared/components/ui/CopyToClipboard';
import { Skeleton } from '@/components/ui/skeleton';
import { SheetClose } from '@/components/ui/sheet';
import { NetworkSelector } from './NetworkSelector';
import { useWalletDrawerAssets } from './useWalletDrawerAssets';

const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const iconButtonClasses =
  'flex size-8 items-center justify-center rounded-full border border-[#bcb6ef]/10 bg-gradient-to-b from-white/0 to-white/8 bg-origin-border text-[#f2f3f7] transition-colors hover:bg-white/10';

interface WalletPreviewHeaderProps {
  ensName?: string | null;
  ensAvatar?: string | null;
  onSwitchAccountClick: () => void;
  onDisconnect: () => void;
  /** M4.6 mobile panel: tighter type scale, 24px avatar and a close button
   *  in the action row (the drawer's collapse rail doesn't exist below md). */
  mobile?: boolean;
}

/**
 * Drawer header on the brand gradient: identity row (avatar/ENS/address+copy)
 * with switch-account and disconnect icon actions, then the wallet's total
 * assets value beside the network control.
 */
export function WalletPreviewHeader({
  ensName,
  ensAvatar,
  onSwitchAccountClick,
  onDisconnect,
  mobile = false
}: WalletPreviewHeaderProps) {
  const { address, connector } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const { totalUsd, isLoading: totalLoading } = useWalletDrawerAssets();

  const truncatedAddress = address ? formatAddress(address) : '';
  const walletIconUrl = connector?.icon || WALLET_ICONS[connector?.id as keyof typeof WALLET_ICONS];

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col justify-between border-b border-[#bcb6ef]/10 bg-gradient-to-b from-[#2a197d] to-[#504dff]',
        // The comp's mobile header is content-sized: 72px between the identity
        // and total rows instead of the desktop's 280px justify-between spread.
        mobile ? 'gap-[72px] px-5 py-6' : 'min-h-[280px] p-7'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center', mobile ? 'gap-2' : 'gap-3')}>
          <div className="relative flex items-center">
            {ensAvatar ? (
              <img
                alt="ENS Avatar"
                className={cn('rounded-full', mobile ? 'size-6' : 'size-8')}
                src={ensAvatar}
              />
            ) : (
              address && <CustomAvatar address={address} size={mobile ? 24 : 32} />
            )}
            {connector && (
              <div className="absolute -right-0.5 -bottom-0.5 rounded-full bg-white p-0.5">
                <WalletIcon connector={connector} iconUrl={walletIconUrl} className="h-3 w-3" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <Text
              tag="span"
              className={cn(
                'font-circle tracking-tight text-[#f2f3f7]',
                mobile ? 'text-sm leading-4' : 'text-base leading-[18px]'
              )}
            >
              {`${isSafeWallet ? 'safe:' : ''}${ensName || truncatedAddress}`}
            </Text>
            <div className="flex items-center gap-1 text-[#f2f3f7] opacity-60">
              <Text
                tag="span"
                variant="captionSm"
                className={cn('text-[#f2f3f7]', mobile ? 'text-[11px] leading-4' : 'leading-[18px]')}
              >
                {truncatedAddress}
              </Text>
              <CopyToClipboard text={address || ''} />
            </div>
          </div>
        </div>
        {(!isSafeWallet || mobile) && (
          <div className="flex items-center gap-2">
            {!isSafeWallet && (
              <>
                <HeaderIconButton
                  label={t`Switch account`}
                  testId="wallet-drawer-switch-account"
                  onClick={onSwitchAccountClick}
                >
                  <ArrowLeftRight className={mobile ? 'size-3' : 'size-3.5'} />
                </HeaderIconButton>
                <HeaderIconButton
                  label={t`Disconnect wallet`}
                  testId="wallet-drawer-disconnect"
                  onClick={onDisconnect}
                >
                  <Unlink className={mobile ? 'size-3' : 'size-3.5'} />
                </HeaderIconButton>
              </>
            )}
            {mobile && (
              <SheetClose
                data-testid="wallet-drawer-close"
                aria-label={t`Close`}
                className={iconButtonClasses}
              >
                <X className="size-3" />
              </SheetClose>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {totalLoading && totalUsd === 0 ? (
          <Skeleton className={cn(mobile ? 'h-9 w-32' : 'h-12 w-40')} />
        ) : (
          <Text
            tag="span"
            dataTestId="wallet-drawer-total"
            className={cn(
              'font-circle tracking-[-0.02em] text-[#f2f3f7]',
              mobile ? 'text-[32px] leading-[35px]' : 'text-[44px] leading-[48px]'
            )}
          >
            {formatUsd(totalUsd)}
          </Text>
        )}
        <NetworkSelector compact={mobile} />
      </div>
    </div>
  );
}

function HeaderIconButton({
  label,
  testId,
  onClick,
  children
}: {
  label: string;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className={iconButtonClasses}
    >
      {children}
    </button>
  );
}
