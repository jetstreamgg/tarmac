import { useAvailableTokenRewardContracts, useMultipleRewardsChartInfo } from '@/hooks';
import { useChainId } from 'wagmi';

export const useRewardsSuppliersCount = (overrideChainId?: number) => {
  const connectedChainId = useChainId();
  const chainId = overrideChainId ?? connectedChainId;
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  const { data, isLoading, error } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContracts.map(contract => contract.contractAddress.toLowerCase()),
    limit: 1
  });

  const totalSuppliers = data?.reduce((acc, chartData) => acc + (chartData[0]?.suppliers || 0), 0) ?? 0;

  return {
    data: totalSuppliers,
    isLoading,
    error
  };
};
