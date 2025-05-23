import { Checkbox } from '@widgets/components/ui/checkbox';
import { useChains } from 'wagmi';

type BalancesFilterProps = {
  showBalanceFilter: boolean;
  showAllNetworks: boolean;
  hideZeroBalances: boolean;
  setShowAllNetworks: (value: boolean) => void;
  setHideZeroBalances: (value: boolean) => void;
  chainId: number;
};

export const BalancesFilter = ({
  showBalanceFilter,
  showAllNetworks,
  hideZeroBalances,
  setShowAllNetworks,
  setHideZeroBalances,
  chainId
}: BalancesFilterProps): React.ReactElement => {
  const chains = useChains();
  const chainInfo = chains.find(chain => chain.id === chainId);
  const chainName = chainInfo?.name;
  return (
    <div className="mb-4 mt-3 flex justify-between">
      <div className="flex items-center gap-2">
        <span className="text-textSecondary text-sm">Network:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAllNetworks(true)}
            className={`text-sm ${showAllNetworks ? 'text-text' : 'text-textSecondary'}`}
          >
            All
          </button>
          <span className="text-sm">|</span>
          <button
            onClick={() => setShowAllNetworks(false)}
            className={`text-sm ${!showAllNetworks ? 'text-text' : 'text-textSecondary'}`}
          >
            {chainName || 'Active'}
          </button>
        </div>
      </div>

      {showBalanceFilter && (
        <div className="flex items-center gap-1.5">
          <Checkbox id="all-balances" checked={hideZeroBalances} onCheckedChange={setHideZeroBalances} />
          <label htmlFor="all-balances" className="text-textSecondary cursor-pointer select-none text-sm">
            Hide 0 balances
          </label>
        </div>
      )}
    </div>
  );
};
