import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import {
  historyQueryArgs,
  historyPageBoundary,
  clampHistoryPage,
  HistoryPage
} from '../shared/historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from '../shared/useHistoryPagination';
import { useConnection, useChainId } from 'wagmi';
import { TOKENS } from '../tokens/tokens.constants';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { SavingsHistory } from '../savings/savings';

const SWAP_FIELDS = `
      transactionHash
      assetIn
      assetOut
      sender
      amountIn
      amountOut
      blockTimestamp
`;

/**
 * sUSDS swaps on an L2 PSM read as savings supplies/withdrawals. `aliasSuffix`
 * keeps aliases unique when several chains share one document.
 */
export function l2SavingsHistoryFragments({
  wallet,
  chainId,
  aliasSuffix = '',
  beforeTimestamp
}: {
  wallet: string;
  chainId: number;
  aliasSuffix?: string;
  beforeTimestamp?: number;
}): string {
  const sUsdsAddress = TOKENS.susds.address[chainId].toLowerCase();
  const walletFilter = `sender: { _eq: "${wallet}" }, receiver: { _eq: "${wallet}" }`;
  const inArgs = historyQueryArgs(
    `${walletFilter}, assetIn: { _eq: "${sUsdsAddress}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  const outArgs = historyQueryArgs(
    `${walletFilter}, assetOut: { _eq: "${sUsdsAddress}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  return `
    usdsIn${aliasSuffix}: Swap${inArgs} {${SWAP_FIELDS}}
    usdsOut${aliasSuffix}: Swap${outArgs} {${SWAP_FIELDS}}
  `;
}

export function mapL2SavingsRows(
  usdsIn: any[],
  usdsOut: any[],
  chainId: number,
  tokenAddressMap: { [address: string]: (typeof TOKENS)[keyof typeof TOKENS] }
): SavingsHistory {
  const swapsInParsed: SavingsHistory = usdsIn
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
        token,
        address: e.sender,
        chainId
      };
    })
    .filter((swap): swap is NonNullable<typeof swap> => swap !== null);

  const swapsOutParsed: SavingsHistory = usdsOut
    .map((e: any) => {
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
        token,
        address: e.sender,
        chainId
      };
    })
    .filter((swap): swap is NonNullable<typeof swap> => swap !== null);

  return [...swapsInParsed, ...swapsOutParsed].sort(
    (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

async function fetchL2SavingsHistoryPage(
  urlIndexer: string,
  chainId: number,
  address?: string,
  tokenAddressMap?: { [address: string]: (typeof TOKENS)[keyof typeof TOKENS] },
  beforeTimestamp?: number
): Promise<HistoryPage<SavingsHistory[number]>> {
  if (!address || !tokenAddressMap || Object.keys(tokenAddressMap).length === 0) {
    return { items: [], nextCursor: undefined };
  }

  const query = gql`
  {
    ${l2SavingsHistoryFragments({ wallet: address.toLowerCase(), chainId, beforeTimestamp })}
  }
  `;

  const response = (await request(urlIndexer, query)) as any;
  const nextCursor = historyPageBoundary(response);
  return {
    items: clampHistoryPage(
      mapL2SavingsRows(response.usdsIn, response.usdsOut, chainId, tokenAddressMap),
      nextCursor
    ),
    nextCursor
  };
}

export function useL2SavingsHistory({
  indexerUrl,
  enabled = true,
  chainId
}: {
  indexerUrl?: string;
  enabled?: boolean;
  chainId?: number;
} = {}): ReadHook & PaginatedHistory & { data?: SavingsHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = chainId ?? currentChainId;
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainIdToUse) || '';
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);
  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer) && enabled && Boolean(tokenAddressMap) && Boolean(address),
      queryKey: ['L2-savings-history', urlIndexer, address, chainIdToUse],
      fetchPage: beforeTimestamp =>
        fetchL2SavingsHistoryPage(urlIndexer, chainIdToUse, address, tokenAddressMap, beforeTimestamp)
    });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
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
