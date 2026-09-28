import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
import { useChainId } from 'wagmi';
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
        blockTimestamp: secondsToDate(e.blockTimestamp),
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
} = {}): ReadHook & PaginatedHistory & { data?: PsmTradeHistory } {
  const currentChainId = useChainId();
  const chainIdToUse = chainId || currentChainId;
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);

  return useIndexerFamilyHistory<PsmTradeHistoryItem>({
    indexerUrl,
    chainId: chainIdToUse,
    enabled: enabledProp && Boolean(tokenAddressMap),
    requireAddress: true,
    ready: Boolean(tokenAddressMap) && Object.keys(tokenAddressMap).length > 0,
    queryKey: ({ urlIndexer, address, chainId }) => [
      'psm-trade-history',
      urlIndexer,
      address,
      excludeSUsds,
      chainId,
      maxBlockTimestamp
    ],
    fragments: ({ owner, chainId, beforeTimestamp }) =>
      psmTradeFragment({
        alias: 'swaps',
        wallet: owner,
        chainId,
        excludeSUsds,
        maxBlockTimestamp,
        beforeTimestamp
      }),
    // Already ordered blockTimestamp desc by the indexer.
    mapPage: (response, chainId) => mapPsmTradeRows(response.swaps, chainId, tokenAddressMap)
  });
}
