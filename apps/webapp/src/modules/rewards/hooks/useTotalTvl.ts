import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import {
  RewardContractInfo,
  useAvailableTokenRewardContracts,
  useRewardContractsInfo
} from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export const useTotalTvl = () => {
  const chainId = useChainId();
  const subgraphUrl = useSubgraphUrl();
  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const {
    data: rewardContractsInfo,
    isLoading,
    error
  } = useRewardContractsInfo({ chainId, rewardContracts, subgraphUrl });

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
