import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { WalletCard } from '@/widgets';
import { useSuppliedBalancesTotalUsd } from '@/widgets/BalancesWidget/hooks/useSuppliedBalancesTotalUsd';
import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import { WALLET_ICONS } from '@/lib/constants';
import { formatNumber } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { WalletIcon } from '@/modules/ui/components/WalletIcon';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Skeleton } from '@/components/ui/skeleton';
import { NetworkSelector } from './NetworkSelector';

interface WalletPreviewHeaderProps {
  ensName?: string | null;
  ensAvatar?: string | null;
  onSwitchAccountClick: () => void;
}

/** Drawer header: identity row (avatar/ENS/addr + copy/explorer/switch) and the network control. */
export function WalletPreviewHeader({ ensName, ensAvatar, onSwitchAccountClick }: WalletPreviewHeaderProps) {
  const { onExternalLinkClicked } = useConfigContext();
  const { connector } = useConnection();
  const chainId = useChainId();
  const { totalUsd, isLoading: totalLoading } = useSuppliedBalancesTotalUsd({
    chainIds: getSupportedChainIds(chainId)
  });

  return (
    <div className="flex flex-col gap-4">
      <WalletCard
        className="mb-0"
        iconSize={40}
        showEns={true}
        ensName={ensName}
        ensAvatar={ensAvatar}
        showExplorerLink={true}
        onSwitchAccountClick={onSwitchAccountClick}
        onExternalLinkClicked={onExternalLinkClicked}
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
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <Text variant="medium" className="text-textSecondary">
            <Trans>Total supplied</Trans>
          </Text>
          {totalLoading || totalUsd === undefined ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <Text data-testid="wallet-drawer-total" className="text-text text-2xl">
              ${formatNumber(totalUsd, { maxDecimals: 2 })}
            </Text>
          )}
        </div>
        <NetworkSelector />
      </div>
    </div>
  );
}
