import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
import { useChainId } from 'wagmi';
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
        blockTimestamp: secondsToDate(e.blockTimestamp),
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
        blockTimestamp: secondsToDate(e.blockTimestamp),
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

export function useL2SavingsHistory({
  indexerUrl,
  enabled = true,
  chainId
}: {
  indexerUrl?: string;
  enabled?: boolean;
  chainId?: number;
} = {}): ReadHook & PaginatedHistory & { data?: SavingsHistory } {
  const currentChainId = useChainId();
  const chainIdToUse = chainId ?? currentChainId;
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);

  return useIndexerFamilyHistory<SavingsHistory[number]>({
    indexerUrl,
    chainId: chainIdToUse,
    enabled: enabled && Boolean(tokenAddressMap),
    requireAddress: true,
    ready: Boolean(tokenAddressMap) && Object.keys(tokenAddressMap).length > 0,
    queryKey: ({ urlIndexer, address, chainId }) => ['L2-savings-history', urlIndexer, address, chainId],
    fragments: ({ owner, chainId, beforeTimestamp }) =>
      l2SavingsHistoryFragments({ wallet: owner, chainId, beforeTimestamp }),
    mapPage: (response, chainId) =>
      mapL2SavingsRows(response.usdsIn, response.usdsOut, chainId, tokenAddressMap)
  });
}
