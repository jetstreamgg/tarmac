import { useIndexerUrl } from '@/modules/app/hooks/useIndexerUrl';
import { RewardContractInfo, useAvailableTokenRewardContracts, useRewardContractsInfo } from '@/hooks';
import { useChainId } from 'wagmi';

export const useTotalTvl = () => {
  const chainId = useChainId();
  const indexerUrl = useIndexerUrl();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const {
    data: rewardContractsInfo,
    isLoading,
    error
  } = useRewardContractsInfo({ chainId, rewardContracts, indexerUrl });

  const totalTvl = extractTvl(rewardContractsInfo as RewardContractInfo[]);

  return { data: totalTvl, isLoading, error };
};

function extractTvl(data?: RewardContractInfo[]) {
  if (!data) {
    return 0n;
  }

  const totalTvl = data.reduce((sum, rewardContract) => sum + BigInt(rewardContract.totalSupplied), 0n);

  return totalTvl;
}
