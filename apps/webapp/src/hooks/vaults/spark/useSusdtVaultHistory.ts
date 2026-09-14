import { ReadHook } from '../../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../../constants';
import { historyQueryArgs, secondsToDate } from '../../shared/historyQueryHelpers';
import { PaginatedHistory } from '../../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../../shared/useIndexerFamilyHistory';
import {
  SusdtVaultSupply,
  SusdtVaultWithdrawal,
  SusdtVaultHistory,
  SusdtVaultSupplyResponse,
  SusdtVaultWithdrawResponse
} from './susdtVaultHistory';
import { TOKENS } from '../../tokens/tokens.constants';

export function susdtHistoryFragments({
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
      susdtDeposits: SusdtDeposit${args} {
        assets
        blockTimestamp
        transactionHash
      }
      susdtWithdraws: SusdtWithdraw${args} {
        assets
        blockTimestamp
        transactionHash
      }
  `;
}

export function mapSusdtHistoryResponse(response: any, chainId: number): SusdtVaultHistory {
  const supplies: SusdtVaultSupply[] = response.susdtDeposits.map((d: SusdtVaultSupplyResponse) => ({
    assets: BigInt(d.assets),
    blockTimestamp: secondsToDate(d.blockTimestamp),
    transactionHash: d.transactionHash,
    module: ModuleEnum.SUSDT,
    type: TransactionTypeEnum.SUPPLY,
    token: TOKENS.usdt,
    chainId
  }));

  const withdraws: SusdtVaultWithdrawal[] = response.susdtWithdraws.map((w: SusdtVaultWithdrawResponse) => ({
    assets: -BigInt(w.assets), //make withdrawals negative
    blockTimestamp: secondsToDate(w.blockTimestamp),
    transactionHash: w.transactionHash,
    module: ModuleEnum.SUSDT,
    type: TransactionTypeEnum.WITHDRAW,
    token: TOKENS.usdt,
    chainId
  }));

  const combined = [...supplies, ...withdraws];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

export function useSusdtVaultHistory({
  indexerUrl,
  enabled = true
}: {
  indexerUrl?: string;
  enabled?: boolean;
} = {}): ReadHook & PaginatedHistory & { data?: SusdtVaultHistory } {
  return useIndexerFamilyHistory<SusdtVaultHistory[number]>({
    indexerUrl,
    familyMainnet: true,
    enabled,
    queryKey: ({ urlIndexer, address, chainId }) => ['susdt-vault-history', urlIndexer, address, chainId],
    fragments: susdtHistoryFragments,
    mapPage: mapSusdtHistoryResponse
  });
}
