import { usdsSkyRewardAbi } from '../generated';
import { useReadContract } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { DataSource, ReadHook } from '../hooks';
import { useRewardsTotalSupplied } from './useRewardsTotalSupplied';
import { formatPercent, getEtherscanLink, math } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS } from '../constants';
import { usePrices } from '../prices/usePrices';
import { useTokens } from '../tokens/useTokens';
import { useLsMkrPrice } from '../prices/useLsMkrPrice';
import { getTokenDecimals } from '../tokens/tokens.constants';

type UseRewardsRateResponse = ReadHook & {
  data: { value: bigint | undefined; formatted: string | undefined };
};

export function useRewardsRate({
  contractAddress,
  chainId
}: {
  contractAddress: Address;
  chainId: number;
}): UseRewardsRateResponse {
  const {
    data: totalSupplied,
    dataSources: totalSupplyDataSource,
    isLoading: tsIsLoading,
    error: tsError,
    mutate: tsRefetch
  } = useRewardsTotalSupplied({
    chainId: chainId as any,
    contractAddress
  });

  const rewardRateDataSource: DataSource = {
    onChain: true,
    href: getEtherscanLink(chainId, contractAddress, 'address'),
    title: 'StakingRewards Contract. rewardRate',
    trustLevel: TRUST_LEVELS[0]
  };

  const {
    data: rewardRate,
    isLoading: rrIsLoading,
    error: rrError,
    refetch: rrRefetch
  } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'rewardRate',
    query: {
      enabled: !!totalSupplied
    }
  });

  const {
    data: rewardToken,
    isLoading: rtIsLoading,
    error: rtError,
    refetch: rtRefetch
  } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'rewardsToken',
    query: {
      enabled: !!totalSupplied
    }
  });

  const {
    data: supplyToken,
    isLoading: stIsLoading,
    error: stError,
    refetch: stRefetch
  } = useReadContract({
    chainId: chainId as any,
    address: contractAddress,
    abi: usdsSkyRewardAbi,
    functionName: 'stakingToken',
    query: {
      enabled: !!totalSupplied
    }
  });

  const { data: pricesData } = usePrices();
  const { data: lsMkrPriceData } = useLsMkrPrice();
  if (pricesData && lsMkrPriceData) {
    pricesData['LSMKR'] = lsMkrPriceData;
  }

  const tokens = useTokens(chainId);

  const rewardTokenInfo = tokens.find(t => t.address === rewardToken);
  const supplyTokenInfo = tokens.find(t => t.address === supplyToken);

  const rewardsTokenPrice = rewardTokenInfo ? pricesData?.[rewardTokenInfo.symbol] : undefined;
  const supplyTokenPrice = supplyTokenInfo ? pricesData?.[supplyTokenInfo.symbol] : undefined;

  const mutate = () => {
    tsRefetch();
    rrRefetch();
    rtRefetch();
    stRefetch();
  };

  const value =
    rewardTokenInfo?.address &&
    supplyTokenInfo?.address &&
    rewardRate &&
    totalSupplied &&
    totalSupplied > 0 &&
    rewardsTokenPrice?.price &&
    supplyTokenPrice?.price
      ? math.getRewardsRate(
          math.tokenValue(
            rewardRate,
            parseUnits(rewardsTokenPrice.price, getTokenDecimals(rewardTokenInfo, chainId))
          ),
          math.tokenValue(
            totalSupplied,
            parseUnits(supplyTokenPrice.price, getTokenDecimals(supplyTokenInfo, chainId))
          )
        )
      : undefined;

  return {
    data: {
      value,
      formatted: value ? formatPercent(value) : undefined
    },
    isLoading: tsIsLoading || rrIsLoading || rtIsLoading || stIsLoading,
    error: tsError || rrError || rtError || stError,
    mutate,
    dataSources: [...totalSupplyDataSource, rewardRateDataSource]
  };
}
