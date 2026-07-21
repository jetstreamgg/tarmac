import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { HistoryItem } from '../shared/shared';
import { TOKENS } from '../tokens/tokens.constants';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { Token } from '../tokens/types';

type PsmTradeHistoryItem = HistoryItem & {
  fromAmount: bigint;
  toAmount: bigint;
  fromToken: Token;
  toToken: Token;
  address: string;
};

type PsmTradeHistory = PsmTradeHistoryItem[];

/**
 * PSM swaps read as trades. The cutoff (`maxBlockTimestamp`, hybrid chains) and
 * the keyset cursor (`beforeTimestamp`) both constrain `blockTimestamp`, so
 * they are merged into one comparison object here rather than passed through
 * `historyQueryArgs` (a duplicated input field is invalid GraphQL).
 */
export function psmTradeFragment({
  alias,
  wallet,
  chainId,
  excludeSUsds = false,
  maxBlockTimestamp,
  beforeTimestamp
}: {
  alias: string;
  wallet: string;
  chainId: number;
  excludeSUsds?: boolean;
  maxBlockTimestamp?: number;
  beforeTimestamp?: number;
}): string {
  const conditions = [
    `sender: { _eq: "${wallet}" }`,
    `receiver: { _eq: "${wallet}" }`,
    `chainId: { _eq: ${chainId} }`
  ];

  if (excludeSUsds) {
    const sUsdsAddress = TOKENS.susds.address[chainId].toLowerCase();
    conditions.push(`assetIn: { _neq: "${sUsdsAddress}" }`, `assetOut: { _neq: "${sUsdsAddress}" }`);
  }

  const timestampConditions = [
    ...(maxBlockTimestamp ? [`_lte: "${maxBlockTimestamp}"`] : []),
    ...(beforeTimestamp ? [`_lt: "${beforeTimestamp}"`] : [])
  ];
  if (timestampConditions.length > 0) {
    conditions.push(`blockTimestamp: { ${timestampConditions.join(', ')} }`);
  }

  return `
    ${alias}: Swap${historyQueryArgs(conditions.join(', '))} {
      transactionHash
      assetIn
      assetOut
      sender
      amountIn
      amountOut
      blockTimestamp
    }
  `;
}

export function mapPsmTradeRows(
  rows: any[],
  chainId: number,
  tokenAddressMap: { [address: string]: (typeof TOKENS)[keyof typeof TOKENS] }
): PsmTradeHistory {
  return rows
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
        address: e.sender,
        chainId
      };
    })
    .filter((swap: PsmTradeHistoryItem | null) => swap !== null);
}

async function fetchPsmTradeHistory(
  urlIndexer: string,
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

  const query = gql`
  {
    ${psmTradeFragment({
      alias: 'swaps',
      wallet: address.toLowerCase(),
      chainId,
      excludeSUsds,
      maxBlockTimestamp
    })}
  }
  `;

  const response = (await request(urlIndexer, query)) as any;

  // Already ordered blockTimestamp desc by the indexer.
  return mapPsmTradeRows(response.swaps, chainId, tokenAddressMap);
}

export function usePsmTradeHistory({
  indexerUrl,
  enabled: enabledProp = true,
  excludeSUsds = false,
  chainId,
  maxBlockTimestamp
}: {
  indexerUrl?: string;
  enabled?: boolean;
  excludeSUsds?: boolean;
  chainId?: number;
  maxBlockTimestamp?: number;
} = {}): ReadHook & { data?: PsmTradeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = chainId || currentChainId;
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainIdToUse) || '';
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer) && enabledProp && Boolean(tokenAddressMap) && Boolean(address),
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['psm-trade-history', urlIndexer, address, excludeSUsds, chainIdToUse, maxBlockTimestamp],
    queryFn: () =>
      fetchPsmTradeHistory(
        urlIndexer,
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
        title: 'Sky Ecosystem indexer',
        href: urlIndexer,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
