import React, { useMemo } from 'react';
import { useConnection } from 'wagmi';
import { Text } from '@widgets/shared/components/ui/Typography';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { Card } from '@widgets/components/ui/card';
import { CopyToClipboard } from '@widgets/shared/components/ui/CopyToClipboard';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { useChainId } from 'wagmi';
import {
  isBaseChainId,
  isArbitrumChainId,
  isOptimismChainId,
  isUnichainChainId,
  useIsSafeWallet
} from '@jetstreamgg/sky-utils';
import { cn } from '@widgets/lib/utils';
import { SwitchAccountButton } from './SwitchAccountButton';

export const WalletCard = ({
  iconSize = 24,
  showEns = false,
  ensAvatar,
  ensName,
  walletIcon,
  className,
  onExternalLinkClicked,
  onSwitchAccountClick
}: {
  iconSize?: number;
  showEns?: boolean;
  ensName?: string | null;
  ensAvatar?: string | null;
  walletIcon?: React.ReactElement;
  className?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onSwitchAccountClick?: () => void;
}): React.ReactElement => {
  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const truncatedAddress = useMemo(
    () => address && address.slice(0, 7) + '...' + address.slice(-5),
    [address]
  );
  const isBaseChain = useMemo(() => isBaseChainId(chainId), [chainId]);
  const isArbitrumChain = useMemo(() => isArbitrumChainId(chainId), [chainId]);
  const isOptimismChain = useMemo(() => isOptimismChainId(chainId), [chainId]);
  const isUnichainChain = useMemo(() => isUnichainChainId(chainId), [chainId]);

  const jazziconComponent = useMemo(() => {
    return address ? <Jazzicon diameter={iconSize} seed={jsNumberForAddress(address)} /> : null;
  }, [address, iconSize]);

  return (
    <Card variant="address" className={cn('mb-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            {showEns && ensAvatar ? (
              <img
                alt="ENS Avatar"
                className="rounded-full"
                style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                src={ensAvatar}
              />
            ) : (
              jazziconComponent
            )}
            {walletIcon && (
              <div className="absolute -right-0.5 -bottom-0.5 rounded-full bg-white p-0.5">{walletIcon}</div>
            )}
          </div>
          {showEns && ensName ? (
            <div className="flex flex-col">
              <Text className="font-circle">{ensName}</Text>
              <Text className="font-circle text-textSecondary">{truncatedAddress}</Text>
            </div>
          ) : (
            <Text className="font-circle">{truncatedAddress}</Text>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onSwitchAccountClick && !isSafeWallet && (
            <SwitchAccountButton onSwitchAccountClick={onSwitchAccountClick} />
          )}
          <CopyToClipboard text={address || ''} />
        </div>
      </div>
      {isBaseChain && (
        <div className="mt-3 flex">
          <Text variant="medium">
            Learn how to{' '}
            <ExternalLink
              href="https://bridge.base.org/deposit"
              iconSize={11}
              className="text-textEmphasis inline"
              inline
              onExternalLinkClicked={onExternalLinkClicked}
            >
              <span className="inline">bridge your assets to Base.</span>
            </ExternalLink>
          </Text>
        </div>
      )}
      {isArbitrumChain && (
        <div className="mt-3 flex">
          <Text variant="medium">
            Learn how to{' '}
            <ExternalLink
              href="https://bridge.arbitrum.io/?destinationChain=arbitrum-one&sourceChain=ethereum"
              iconSize={11}
              className="text-textEmphasis inline"
              inline
              onExternalLinkClicked={onExternalLinkClicked}
            >
              <span className="inline">bridge your assets to Arbitrum.</span>
            </ExternalLink>
          </Text>
        </div>
      )}
      {isOptimismChain && (
        <div className="mt-3 flex">
          <Text variant="medium">
            Learn how to{' '}
            <ExternalLink
              href="https://app.optimism.io/bridge"
              iconSize={11}
              className="text-textEmphasis inline"
              inline
              onExternalLinkClicked={onExternalLinkClicked}
            >
              <span className="inline">bridge your assets to OP Mainnet.</span>
            </ExternalLink>
          </Text>
        </div>
      )}
      {isUnichainChain && (
        <div className="mt-3 flex">
          <Text variant="medium">
            Learn how to{' '}
            <ExternalLink
              href="https://www.unichain.org/bridge"
              iconSize={11}
              className="text-textEmphasis inline"
              inline
              onExternalLinkClicked={onExternalLinkClicked}
            >
              <span className="inline">bridge your assets to Unichain.</span>
            </ExternalLink>
          </Text>
        </div>
      )}
    </Card>
  );
};
