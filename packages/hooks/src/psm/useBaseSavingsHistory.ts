import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getBaseSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useChainId } from 'wagmi';
import { TOKENS } from '../tokens/tokens.constants';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { SavingsHistory, SavingsHistoryItem } from '../savings/savings';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/utils';

async function fetchBaseSavingsHistory(
  urlSubgraph: string,
  chainId: number,
  address?: string,
  tokenAddressMap?: Record<string, { symbol: string }>
): Promise<SavingsHistory | undefined> {
  if (!address) return [];

  if (!tokenAddressMap || Object.keys(tokenAddressMap).length === 0) {
    return [];
  }

  const sUsdsAddressForChain = TOKENS.susds.address[chainId];
  const query = gql`
  {
    usdsIn: swaps(where: {
      sender: "${address}",
      receiver: "${address}",
      assetIn: "${sUsdsAddressForChain.toLowerCase()}"
    }) {
      id
      transactionHash
      assetIn
      assetOut
      sender
      receiver
      amountIn
      amountOut
      referralCode
      blockTimestamp
    }
    usdsOut: swaps(where: {
      sender: "${address}",
      receiver: "${address}",
      assetOut: "${sUsdsAddressForChain.toLowerCase()}"
    }) {
      id
      transactionHash
      assetIn
      assetOut
      sender
      receiver
      amountIn
      amountOut
      referralCode
      blockTimestamp
    }
  }
  `;

  const response = (await request(urlSubgraph, query)) as any;

  const swapsInParsed: SavingsHistory = response.usdsIn
    .map((e: any) => {
      const tokenAddress = e.assetOut.toLowerCase();
      const token = tokenAddressMap[tokenAddress];

      if (!token) {
        console.warn(
          `Skipping savings withdrawal due to missing token mapping for chainId ${chainId}:`,
          `token (${tokenAddress}): ${!!token}`
        );
        return null;
      }

      return {
        blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
        transactionHash: e.transactionHash,
        module: ModuleEnum.SAVINGS,
        type: TransactionTypeEnum.WITHDRAW,
        shares: BigInt(e.amountIn),
        assets: BigInt(e.amountOut),
        referralCode: e.referralCode,
        token,
        address: e.sender,
        chainId
      };
    })
    .filter((swap: SavingsHistoryItem | null) => swap !== null);

  const swapsOutParsed: SavingsHistory = response.usdsOut.map((e: any) => {
    const tokenAddress = e.assetIn.toLowerCase();
    const token = tokenAddressMap[tokenAddress];

    if (!token) {
      console.warn(
        `Skipping savings supply due to missing token mapping for chainId ${chainId}:`,
        `token (${tokenAddress}): ${!!token}`
      );
      return null;
    }

    return {
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.SAVINGS,
      type: TransactionTypeEnum.SUPPLY,
      assets: BigInt(e.amountIn),
      shares: BigInt(e.amountOut),
      referralCode: e.referralCode,
      token,
      address: e.sender,
      chainId
    };
  });

  return [...swapsInParsed, ...swapsOutParsed].sort(
    (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

export function useBaseSavingsHistory({
  subgraphUrl,
  enabled = true
}: {
  subgraphUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & { data?: SavingsHistory } {
  const { address } = useAccount();
  const chainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getBaseSubgraphUrl(chainId) || '';
  const fetchedChainId = isTestnetId(chainId) ? chainIdMap.tenderlyBase : chainIdMap.base;
  const tokenAddressMap = useTokenAddressMap(fetchedChainId);
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph) && enabled && Boolean(tokenAddressMap) && Boolean(address),
    queryKey: ['base-savings-history', urlSubgraph, address, fetchedChainId],
    queryFn: () => fetchBaseSavingsHistory(urlSubgraph, fetchedChainId, address, tokenAddressMap)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
