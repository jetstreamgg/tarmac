import { ReadHook } from '../hooks';
import { StUsdsHistoryItem } from './stusds';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { TOKENS } from '../tokens/tokens.constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
import { CURVE_POOL_TOKEN_INDICES } from './providers/constants';
import { StUsdsProviderType } from './providers/types';

// Native stUSDS deposits/withdrawals plus Curve pool swaps in/out of stUSDS.
export function stusdsHistoryFragments({
  owner,
  chainId,
  beforeTimestamp
}: {
  owner: string;
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const ownerArgs = historyQueryArgs(
    `owner: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  const buyerArgs = historyQueryArgs(
    `buyer: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  return `
      stusdsDeposits: StusdsDeposit${ownerArgs} {
        assets
        blockTimestamp
        transactionHash
      }
      stusdsWithdraws: StusdsWithdraw${ownerArgs} {
        assets
        blockTimestamp
        transactionHash
      }
      curveTokenExchanges: CurveTokenExchange${buyerArgs} {
        soldId
        amountSold
        boughtId
        amountBought
        blockTimestamp
        transactionHash
      }
  `;
}

export function mapStusdsHistoryResponse(response: any, chainId: number) {
  const supplies = (response.stusdsDeposits || []).map((d: any) => ({
    assets: BigInt(d.assets),
    blockTimestamp: secondsToDate(d.blockTimestamp),
    transactionHash: d.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usds,
    chainId,
    provider: StUsdsProviderType.NATIVE
  }));

  const withdraws = (response.stusdsWithdraws || []).map((w: any) => ({
    assets: -BigInt(w.assets),
    blockTimestamp: secondsToDate(w.blockTimestamp),
    transactionHash: w.transactionHash,
    module: ModuleEnum.STUSDS,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usds,
    chainId,
    provider: StUsdsProviderType.NATIVE
  }));

  const curveSwaps = (response.curveTokenExchanges || []).map((c: any) => {
    const soldId = parseInt(c.soldId);
    // If user sold USDS (index 0), it's a supply (USDS → stUSDS)
    // If user sold stUSDS (index 1), it's a withdraw (stUSDS → USDS)
    const isSupply = soldId === CURVE_POOL_TOKEN_INDICES.USDS;

    return {
      // For supply: positive USDS amount sold
      // For withdraw: negative USDS amount received
      assets: isSupply ? BigInt(c.amountSold) : -BigInt(c.amountBought),
      blockTimestamp: secondsToDate(c.blockTimestamp),
      transactionHash: c.transactionHash,
      module: ModuleEnum.STUSDS,
      type: isSupply ? TransactionTypeEnum.SUPPLY : TransactionTypeEnum.WITHDRAW,
      token: TOKENS.usds,
      chainId,
      provider: StUsdsProviderType.CURVE
    };
  });

  const combined = [...supplies, ...withdraws, ...curveSwaps];
  return combined.sort(
    (a: { blockTimestamp: Date }, b: { blockTimestamp: Date }) =>
      b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
}

export type StUsdsHistoryHook = ReadHook &
  PaginatedHistory & {
    data?: StUsdsHistoryItem[];
  };

export function useStUsdsHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): StUsdsHistoryHook {
  return useIndexerFamilyHistory<StUsdsHistoryItem>({
    indexerUrl,
    familyMainnet: true,
    enabled,
    queryKey: ({ urlIndexer, address, chainId }) => ['stusds-history', urlIndexer, address, chainId],
    fragments: stusdsHistoryFragments,
    mapPage: mapStusdsHistoryResponse
  });
}
