import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import {
  getConvertUrl,
  getFixedYieldUrl,
  getRewardsUrl,
  getSavingsUrl,
  getStakeUrl,
  getStUsdsUrl,
  getVaultsOverviewUrl
} from '@/lib/utils';
import { useAppSearchParams } from '@/lib/navigation';
import { useChainId, useChains } from 'wagmi';

export const useModuleUrls = () => {
  const [searchParams] = useAppSearchParams();
  const chainId = useChainId();
  const supportedChainIds = getSupportedChainIds(chainId);
  const chains = useChains();

  const rewardsUrl = getRewardsUrl(searchParams, chainId, chains);
  const savingsUrlMap: Record<number, string> = {};
  for (const chainId of supportedChainIds) {
    savingsUrlMap[chainId] = getSavingsUrl(searchParams, chainId, chains);
  }
  const stakeUrl = getStakeUrl(searchParams, chainId, chains);
  const stusdsUrl = getStUsdsUrl(searchParams, chainId, chains);
  const vaultsUrl = getVaultsOverviewUrl(searchParams, chainId, chains);
  const convertUrl = getConvertUrl(searchParams, chainId);
  const fixedYieldUrl = getFixedYieldUrl(searchParams, chainId, chains);

  return {
    rewardsUrl,
    savingsUrlMap,
    stakeUrl,
    stusdsUrl,
    vaultsUrl,
    convertUrl,
    fixedYieldUrl
  };
};
