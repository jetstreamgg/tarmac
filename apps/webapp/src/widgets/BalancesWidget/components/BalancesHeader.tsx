import { useConnection, useBalance } from 'wagmi';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { AssetsNoWalletConnected } from '@/widgets/BalancesWidget/components/AssetsNoWalletConnected';
import { WalletCard } from './WalletCard';

export const BalancesHeader = ({
  isConnectedAndEnabled
}: {
  isConnectedAndEnabled: boolean;
}): React.ReactElement => {
  const { address } = useConnection();
  const { data: ethBalance, isLoading: isEthBalanceLoading } = useBalance({ address });

  return !isConnectedAndEnabled ? (
    <AssetsNoWalletConnected />
  ) : isEthBalanceLoading || !ethBalance || !address ? (
    <Skeleton className="bg-card h-8" />
  ) : (
    <WalletCard />
  );
};
