import { useConnection, useBalance } from 'wagmi';
import { Skeleton } from '@widgets/components/ui/skeleton';
import { Tabs, TabsContent } from '@widgets/components/ui/tabs';
import { BalancesTabsList } from '@widgets/widgets/BalancesWidget/components/BalancesTabsList';
import { AssetsNoWalletConnected } from '@widgets/widgets/BalancesWidget/components/AssetsNoWalletConnected';
import { HistoryNoWalletConnected } from '@widgets/widgets/BalancesWidget/components/HistoryNoWalletConnected';
import { BalancesFlow } from '../constants';
import { WalletCard } from './WalletCard';

export const BalancesHeader = ({
  tabIndex,
  isConnectedAndEnabled,
  onExternalLinkClicked,
  onToggle
}: {
  tabIndex: 0 | 1;
  isConnectedAndEnabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onToggle: (number: 0 | 1) => void;
}): React.ReactElement => {
  const { address } = useConnection();
  const { data: ethBalance, isLoading: isEthBalanceLoading } = useBalance({ address });

  return !isConnectedAndEnabled ? (
    <div>
      <Tabs value={tabIndex === 1 ? BalancesFlow.TX_HISTORY : BalancesFlow.FUNDS}>
        <BalancesTabsList onToggle={onToggle} />
        <TabsContent className="mt-4" value={BalancesFlow.FUNDS}>
          <AssetsNoWalletConnected />
        </TabsContent>
        <TabsContent className="mt-4" value={BalancesFlow.TX_HISTORY}>
          <HistoryNoWalletConnected />
        </TabsContent>
      </Tabs>
    </div>
  ) : isEthBalanceLoading || !ethBalance || !address ? (
    <Skeleton className="bg-card h-8" />
  ) : (
    <WalletCard onExternalLinkClicked={onExternalLinkClicked} />
  );
};
