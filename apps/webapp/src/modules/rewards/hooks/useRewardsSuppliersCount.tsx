import { useAvailableTokenRewardContracts, useRewardsChartInfo } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

export const useRewardsSuppliersCount = (overrideChainId?: number) => {
  const connectedChainId = useChainId();
  const chainId = overrideChainId ?? connectedChainId;
  const rewardContracts = useAvailableTokenRewardContracts(chainId);

  // TODO: need to do this in a loop rather than hardcoding reward contracts
  const [skyRewardContract, cronRewardContract, spkRewardContract] = rewardContracts;
  const {
    data: skyChartData,
    isLoading: isLoadingSky,
    error: errorSky
  } = useRewardsChartInfo({
    rewardContractAddress: skyRewardContract.contractAddress.toLowerCase()
  });

  const {
    data: spkChartData,
    isLoading: isLoadingSpk,
    error: errorSpk
  } = useRewardsChartInfo({
    rewardContractAddress: spkRewardContract.contractAddress.toLowerCase()
  });

  const {
    data: cronChartData,
    isLoading: isLoadingCron,
    error: errorCron
  } = useRewardsChartInfo({
    rewardContractAddress: cronRewardContract.contractAddress.toLowerCase()
  });

  const mostRecentSkyData = [...(skyChartData || [])].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];
  const mostRecentCronData = [...(cronChartData || [])].sort(
    (a, b) => b.blockTimestamp - a.blockTimestamp
  )[0];
  const mostRecentSpkData = [...(spkChartData || [])].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0];

  const totalSuppliers =
    (mostRecentSkyData?.suppliers || 0) +
    (mostRecentCronData?.suppliers || 0) +
    (mostRecentSpkData?.suppliers || 0);

  return {
    data: totalSuppliers,
    isLoading: isLoadingSky || isLoadingCron || isLoadingSpk,
    error: errorSky || errorCron || errorSpk
  };
};
