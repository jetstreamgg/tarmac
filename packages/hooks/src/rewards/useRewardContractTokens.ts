import { useChainId, useReadContracts } from 'wagmi';
import { ReadHook } from '../hooks';
import { usdsSkyRewardAbi } from '../generated';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { erc20Abi } from 'viem';
import { Token } from '../tokens/types';
import { TOKENS } from '../tokens/tokens.constants';

type UseRewardContractTokensData =
  | {
      supplyToken: Token;
      rewardsToken: Token;
    }
  | undefined;

// Mock contract address for SKY-SKY demo reward
const MOCK_SKY_SKY_REWARD_CONTRACT = '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc' as `0x${string}`;

export const useRewardContractTokens = (
  rewardContractAddress: `0x${string}` | undefined
): ReadHook & { data: UseRewardContractTokensData } => {
  const chainId = useChainId();

  // Return mock data for demo SKY-SKY contract
  if (rewardContractAddress === MOCK_SKY_SKY_REWARD_CONTRACT) {
    return {
      data: {
        supplyToken: TOKENS.sky,
        rewardsToken: TOKENS.sky
      },
      isLoading: false,
      error: null,
      mutate: () => Promise.resolve({} as any),
      dataSources: [
        {
          title: 'Mock SKY-SKY Reward Contract (Demo)',
          onChain: false,
          href: '',
          trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
        }
      ]
    };
  }

  const {
    data: rewardContractTokens,
    isLoading: isRewardContractTokensLoading,
    error: rewardContractTokensError,
    refetch
  } = useReadContracts({
    contracts: [
      {
        address: rewardContractAddress,
        abi: usdsSkyRewardAbi,
        chainId,
        functionName: 'stakingToken'
      },
      {
        address: rewardContractAddress,
        abi: usdsSkyRewardAbi,
        chainId,
        functionName: 'rewardsToken'
      }
    ],
    allowFailure: false,
    query: {
      enabled: !!rewardContractAddress && rewardContractAddress !== ZERO_ADDRESS
    }
  });

  const [supplyToken, rewardsToken] = rewardContractTokens || [];

  const {
    data: tokenSymbols,
    isLoading: isTokenSymbolsLoading,
    error: tokenSymbolsError
  } = useReadContracts({
    contracts: [
      {
        address: supplyToken,
        abi: erc20Abi,
        chainId,
        functionName: 'symbol'
      },
      {
        address: supplyToken,
        abi: erc20Abi,
        chainId,
        functionName: 'name'
      },
      {
        address: supplyToken,
        abi: erc20Abi,
        chainId,
        functionName: 'decimals'
      },
      {
        address: rewardsToken,
        abi: erc20Abi,
        chainId,
        functionName: 'symbol'
      },
      {
        address: rewardsToken,
        abi: erc20Abi,
        chainId,
        functionName: 'name'
      },
      {
        address: rewardsToken,
        abi: erc20Abi,
        chainId,
        functionName: 'decimals'
      }
    ],
    allowFailure: false,
    query: {
      enabled: !!supplyToken && !!rewardsToken
    }
  });

  const data =
    supplyToken && rewardsToken && tokenSymbols
      ? {
          supplyToken: {
            address: { [chainId]: supplyToken },
            symbol: tokenSymbols[0],
            name: tokenSymbols[1],
            decimals: tokenSymbols[2],
            color: ''
          },
          rewardsToken: {
            address: { [chainId]: rewardsToken },
            symbol: tokenSymbols[3],
            name: tokenSymbols[4],
            decimals: tokenSymbols[5],
            color: ''
          }
        }
      : undefined;

  return {
    data,
    isLoading: isRewardContractTokensLoading || isTokenSymbolsLoading,
    error: rewardContractTokensError || tokenSymbolsError,
    mutate: refetch,
    dataSources: rewardContractAddress
      ? [
          {
            title: 'StakingRewards contract. (stakingToken), (rewardsToken) functions',
            onChain: true,
            href: getEtherscanLink(chainId, rewardContractAddress, 'address'),
            trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
          }
        ]
      : []
  };
};
