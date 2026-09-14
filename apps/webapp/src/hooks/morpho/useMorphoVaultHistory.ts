import { useConnection } from 'wagmi';
import { ReadHook } from '../hooks';
import { MorphoVaultHistoryItem, MorphoVaultV2TransactionsApiResponse } from './morpho';
import { useQuery } from '@tanstack/react-query';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import {
  getMorphoVaultByAddress,
  MORPHO_API_CHAIN_ID,
  MORPHO_VAULTS,
  MorphoTransactionType,
  VAULT_V2_TRANSACTIONS_QUERY,
  morphoDataSource
} from './constants';
import { toReadHook } from '../shared/toReadHook';
import { morphoGraphql } from './morphoGraphql';

async function fetchMorphoDepositWithdrawHistory(
  vaultAddress: `0x${string}` | undefined,
  chainId: number,
  address: string
): Promise<MorphoVaultHistoryItem[]> {
  const vaults = vaultAddress
    ? [vaultAddress]
    : MORPHO_VAULTS.map(({ vaultAddress }) => vaultAddress[chainId]);

  const result = await morphoGraphql<MorphoVaultV2TransactionsApiResponse>(VAULT_V2_TRANSACTIONS_QUERY, {
    chainId,
    userAddress: address,
    vaultAddresses: vaults
  });

  return result.data.vaultV2transactions.items.map(transaction => {
    const isSupply = transaction.type === MorphoTransactionType.Deposit;
    const vaultConfig = getMorphoVaultByAddress(
      transaction.vault.address.toLowerCase() as `0x${string}`,
      chainId
    )!;

    return {
      type: isSupply ? TransactionTypeEnum.SUPPLY : TransactionTypeEnum.WITHDRAW,
      assets: isSupply ? BigInt(transaction.data.assets) : -BigInt(transaction.data.assets),
      blockTimestamp: new Date(transaction.timestamp * 1000),
      transactionHash: transaction.txHash,
      module: ModuleEnum.MORPHO,
      chainId,
      token: vaultConfig.assetToken
    };
  });
}

type MorphoVaultHistoryHook = ReadHook & {
  data?: MorphoVaultHistoryItem[];
};

export function useMorphoVaultHistory({
  vaultAddress,
  enabled = true
}: {
  vaultAddress?: `0x${string}`;
  enabled?: boolean;
} = {}): MorphoVaultHistoryHook {
  const { address } = useConnection();

  const query = useQuery({
    enabled: enabled && !!address,
    queryKey: ['morpho-vault-history', vaultAddress || 'all', address],
    // Morpho vaults are mainnet-only
    queryFn: () => fetchMorphoDepositWithdrawHistory(vaultAddress, MORPHO_API_CHAIN_ID, address!)
  });

  return toReadHook(query, [morphoDataSource()]);
}
