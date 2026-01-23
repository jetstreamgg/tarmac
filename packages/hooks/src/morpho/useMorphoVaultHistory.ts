import { useChainId, useConnection } from 'wagmi';
import { ReadHook } from '../hooks';
import { MorphoVaultHistoryItem, MorphoVaultV2TransactionsApiResponse } from './morpho';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { useQuery } from '@tanstack/react-query';
import { ModuleEnum, TransactionTypeEnum, TRUST_LEVELS, TrustLevelEnum } from '../constants';
import {
  getMorphoVaultByAddress,
  MORPHO_API_URL,
  MORPHO_VAULTS,
  MorphoTransactionType,
  VAULT_V2_TRANSACTIONS_QUERY
} from './constants';

async function fetchMorphoDepositWithdrawHistory(
  vaultAddress: `0x${string}` | undefined,
  chainId: number,
  address: string
): Promise<MorphoVaultHistoryItem[]> {
  const vaults = vaultAddress
    ? [vaultAddress]
    : MORPHO_VAULTS.map(({ vaultAddress }) => vaultAddress[chainId]);

  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_V2_TRANSACTIONS_QUERY,
      variables: {
        chainId,
        userAddress: address,
        vaultAddresses: vaults
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultV2TransactionsApiResponse = await response.json();

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

export type MorphoVaultHistoryHook = ReadHook & {
  data?: MorphoVaultHistoryItem[];
};

export function useMorphoVaultHistory({
  vaultAddress,
  enabled = true
}: {
  vaultAddress?: `0x${string}`;
  enabled?: boolean;
}): MorphoVaultHistoryHook {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = isTestnetId(currentChainId) ? mainnet.id : currentChainId;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: enabled && !!address,
    queryKey: ['morpho-vault-history', vaultAddress || 'all', address, chainIdToUse],
    queryFn: () => fetchMorphoDepositWithdrawHistory(vaultAddress, chainIdToUse, address!)
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Morpho API',
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
