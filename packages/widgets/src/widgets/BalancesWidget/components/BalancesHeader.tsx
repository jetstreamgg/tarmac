import { useConnection, useBalance } from 'wagmi';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { AssetsNoWalletConnected } from '@widgets/widgets/BalancesWidget/components/AssetsNoWalletConnected';
import { WalletCard } from './WalletCard';

export const BalancesHeader = ({
  isConnectedAndEnabled,
  onExternalLinkClicked
}: {
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}): React.ReactElement => {
  const { address } = useConnection();
  const { data: ethBalance, isLoading: isEthBalanceLoading } = useBalance({ address });

  return !isConnectedAndEnabled ? (
    <AssetsNoWalletConnected />
  ) : isEthBalanceLoading || !ethBalance || !address ? (
    <Skeleton className="bg-card h-8" />
  ) : (
    <WalletCard onExternalLinkClicked={onExternalLinkClicked} />
  );
};
