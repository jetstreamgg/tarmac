import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getL2SubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { HistoryItem } from '../shared/shared';
import { TOKENS } from '../tokens/tokens.constants';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { Token } from '../tokens/types';

type PsmTradeHistoryItem = HistoryItem & {
  fromAmount: bigint;
  toAmount: bigint;
  referralCode: string;
  fromToken: Token;
  toToken: Token;
  address: string;
};

type PsmTradeHistory = PsmTradeHistoryItem[];

async function fetchPsmTradeHistory(
  urlSubgraph: string,
  chainId: number,
  tokenAddressMap: { [address: string]: (typeof TOKENS)[keyof typeof TOKENS] },
  address?: string,
  excludeSUsds: boolean = false,
  maxBlockTimestamp?: number
): Promise<PsmTradeHistory | undefined> {
  if (!address) return [];

  if (!tokenAddressMap || Object.keys(tokenAddressMap).length === 0) {
    return [];
  }

  const sUsdsAddressForChain = TOKENS.susds.address[chainId];

  let whereClause = `{
    sender: "${address}",
    receiver: "${address}"`;

  if (excludeSUsds) {
    whereClause += `,
    assetIn_not: "${sUsdsAddressForChain.toLowerCase()}",
    assetOut_not: "${sUsdsAddressForChain.toLowerCase()}"`;
  }

  if (maxBlockTimestamp) {
    whereClause += `,
    blockTimestamp_lte: "${maxBlockTimestamp}"`;
  }

  whereClause += '}';

  const query = gql`
  {
    swaps(where: ${whereClause}) {
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

  const swaps: PsmTradeHistory = response.swaps
    .map((e: any) => {
      const fromTokenAddress = e.assetIn.toLowerCase();
      const toTokenAddress = e.assetOut.toLowerCase();

      const fromToken = tokenAddressMap[fromTokenAddress];
      const toToken = tokenAddressMap[toTokenAddress];

      if (!fromToken || !toToken) {
        console.warn(
          `Skipping trade due to missing token mapping for chainId ${chainId}:`,
          `fromToken (${fromTokenAddress}): ${!!fromToken}`,
          `toToken (${toTokenAddress}): ${!!toToken}`
        );
        return null;
      }

      return {
        blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
        transactionHash: e.transactionHash,
        module: ModuleEnum.TRADE,
        type: TransactionTypeEnum.TRADE,
        fromToken,
        toToken,
        fromAmount: BigInt(e.amountIn),
        toAmount: BigInt(e.amountOut),
        referralCode: e.referralCode,
        address: e.sender,
        chainId
      };
    })
    .filter((swap: PsmTradeHistoryItem | null) => swap !== null);

  return swaps.sort(
    (a: PsmTradeHistoryItem, b: PsmTradeHistoryItem) =>
      b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

export function usePsmTradeHistory({
  subgraphUrl,
  enabled: enabledProp = true,
  excludeSUsds = false,
  chainId,
  maxBlockTimestamp
}: {
  subgraphUrl?: string;
  enabled?: boolean;
  excludeSUsds?: boolean;
  chainId?: number;
  maxBlockTimestamp?: number;
} = {}): ReadHook & { data?: PsmTradeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = chainId || currentChainId;
  const urlSubgraph = subgraphUrl ? subgraphUrl : getL2SubgraphUrl(chainIdToUse) || '';
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph) && enabledProp && Boolean(tokenAddressMap) && Boolean(address),
    queryKey: ['psm-trade-history', urlSubgraph, address, excludeSUsds, chainIdToUse, maxBlockTimestamp],
    queryFn: () =>
      fetchPsmTradeHistory(
        urlSubgraph,
        chainIdToUse,
        tokenAddressMap,
        address,
        excludeSUsds,
        maxBlockTimestamp
      )
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
