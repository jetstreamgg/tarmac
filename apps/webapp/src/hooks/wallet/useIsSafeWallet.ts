import { useConnection, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { SAFE_CONNECTOR_ID, SAFE_TRANSACTION_SERVICE_URL } from '../shared/constants';

const isSafeWalletFound = async (url: URL) => {
  const res = await fetch(url);
  return res.status === 200;
};

export const useIsSafeWallet = () => {
  const { address, connector } = useConnection();
  const chainId = useChainId();

  const isSafeConnector = connector?.id === SAFE_CONNECTOR_ID && !!address;
  const baseUrl = SAFE_TRANSACTION_SERVICE_URL[chainId];
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/api/v1/safes/${address}`;
    url = new URL(endpoint);
  }

  // Safe-ness of an address doesn't change — cache the answer for the session
  // and skip the call when we already know the wallet is a Safe via the connector.
  const { data: isAddressSafeWallet } = useQuery({
    enabled: Boolean(url && address) && !isSafeConnector,
    queryKey: ['is-safe-wallet-found', address, chainId],
    queryFn: () => isSafeWalletFound(url!),
    staleTime: Infinity,
    gcTime: Infinity
  });

  return isSafeConnector || !!isAddressSafeWallet;
};
