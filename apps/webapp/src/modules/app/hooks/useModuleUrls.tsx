import { getSupportedChainIds } from '@/data/wagmi/config/config.default';
import {
  getConvertUrl,
  getExpertOverviewUrl,
  getMorphoVaultUrl,
  getRewardsUrl,
  getSavingsUrl,
  getSealUrl,
  getStakeUrl,
  getStUsdsUrl
} from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useChainId, useChains } from 'wagmi';

export const useModuleUrls = () => {
  const [searchParams] = useSearchParams();
  const chainId = useChainId();
  const supportedChainIds = getSupportedChainIds(chainId);
  const chains = useChains();

  const rewardsUrl = getRewardsUrl(searchParams, chainId);
  const savingsUrlMap: Record<number, string> = {};
  for (const chainId of supportedChainIds) {
    savingsUrlMap[chainId] = getSavingsUrl(searchParams, chainId, chains);
  }
  const sealUrl = getSealUrl(searchParams, chainId);
  const stakeUrl = getStakeUrl(searchParams, chainId);
  const expertOverviewUrl = getExpertOverviewUrl(searchParams, chainId);
  const stusdsUrl = getStUsdsUrl(searchParams, chainId);
  const morphoUrl = getMorphoVaultUrl(searchParams, chainId);
  const convertUrl = getConvertUrl(searchParams, chainId);

  return { rewardsUrl, savingsUrlMap, sealUrl, stakeUrl, expertOverviewUrl, stusdsUrl, morphoUrl, convertUrl };
};
