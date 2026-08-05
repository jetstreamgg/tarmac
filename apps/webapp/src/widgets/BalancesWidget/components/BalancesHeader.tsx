import { useConnection, useBalance } from 'wagmi';
import { Skeleton } from '@/components/ui/skeleton';
import { AssetsNoWalletConnected } from '@/widgets/BalancesWidget/components/AssetsNoWalletConnected';
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
    <Skeleton className="h-8" />
  ) : (
    <WalletCard onExternalLinkClicked={onExternalLinkClicked} />
  );
};
