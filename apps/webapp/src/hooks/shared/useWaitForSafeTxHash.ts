import { useChainId } from 'wagmi';
import { SAFE_TRANSACTION_SERVICE_URL } from './constants';
import { useQuery } from '@tanstack/react-query';
import { useIsSafeApp } from '../wallet/useIsSafeApp';

const getTransactionHash = async (url: URL): Promise<`0x${string}`> => {
  const res = await fetch(url);
  const data = await res.json();

  return data.transactionHash as `0x${string}`;
};

/**
 * Inside the Safe App iframe a write returns the safeTxHash, not an on-chain
 * hash; poll the Safe transaction service until the queue executes it. The
 * flag this keys on is returned so a caller selects between the two hashes
 * exactly the way the poll was gated. Over WalletConnect the returned hash is
 * used as-is (APP-567 covers the multi-owner case).
 */
export const useWaitForSafeTxHash = ({
  chainId: paramChainId,
  safeTxHash
}: {
  chainId: number | undefined;
  safeTxHash: string | undefined;
}) => {
  const isSafeApp = useIsSafeApp();
  const hookChainId = useChainId();
  const chainId = paramChainId || hookChainId;
  const baseUrl = SAFE_TRANSACTION_SERVICE_URL[chainId];
  let url: URL | undefined;
  if (baseUrl && safeTxHash) {
    const endpoint = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
    url = new URL(endpoint);
  }

  const { data: transactionHash } = useQuery({
    enabled: Boolean(url && safeTxHash && isSafeApp),
    queryKey: ['safe-transaction-hash', safeTxHash, chainId, isSafeApp],
    queryFn: () => getTransactionHash(url!),
    // Stop refetching if the transaction hash is found or the API has been queried for 5 minutes (150 * 2s = 5 minutes)
    refetchInterval: query => (query.state.data || query.state.dataUpdateCount >= 150 ? false : 2000),
    refetchIntervalInBackground: true
  });

  return { transactionHash, isSafeApp };
};
