import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
import {
  SavingsSupply,
  SavingsHistory,
  SavingsWithdrawal,
  SavingsSupplyResponse,
  SavingsWithdrawalResponse
} from './savings';
import { TOKENS } from '../tokens/tokens.constants';

export function savingsHistoryFragments({
  owner,
  chainId,
  beforeTimestamp
}: {
  owner: string;
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const args = historyQueryArgs(`owner: { _eq: "${owner}" }, chainId: { _eq: ${chainId} }`, beforeTimestamp);
  return `
      savingsSupplies: SavingsSupply${args} {
        assets
        blockTimestamp
        transactionHash
      }
      savingsWithdraws: SavingsWithdraw${args} {
        blockTimestamp
        assets
        transactionHash
      }
  `;
}

export function mapSavingsHistoryResponse(response: any, chainId: number): SavingsHistory {
  const supplies: SavingsSupply[] = response.savingsSupplies.map((d: SavingsSupplyResponse) => ({
    assets: BigInt(d.assets),
    blockTimestamp: secondsToDate(d.blockTimestamp),
    transactionHash: d.transactionHash,
    module: ModuleEnum.SAVINGS,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usds,
    chainId
  }));

  const withdraws: SavingsWithdrawal[] = response.savingsWithdraws.map((w: SavingsWithdrawalResponse) => ({
    assets: -BigInt(w.assets), //make withdrawals negative
    blockTimestamp: secondsToDate(w.blockTimestamp),
    transactionHash: w.transactionHash,
    module: ModuleEnum.SAVINGS,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usds,
    chainId
  }));

  const combined = [...supplies, ...withdraws];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

export function useEthereumSavingsHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & PaginatedHistory & { data?: SavingsHistory } {
  return useIndexerFamilyHistory<SavingsHistory[number]>({
    indexerUrl,
    familyMainnet: true,
    enabled,
    queryKey: ({ urlIndexer, address, chainId }) => ['savings-history', urlIndexer, address, chainId],
    fragments: savingsHistoryFragments,
    mapPage: mapSavingsHistoryResponse
  });
}
