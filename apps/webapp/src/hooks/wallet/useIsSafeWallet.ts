import { useConnection, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { SAFE_TRANSACTION_SERVICE_URL } from '../shared/constants';
import { useIsSafeApp } from './useIsSafeApp';

const isSafeWalletFound = async (url: URL) => {
  const res = await fetch(url);
  return res.status === 200;
};

/**
 * Whether the connected account is a Safe, by any connector: the Safe App
 * iframe, or a Safe paired over WalletConnect. Drives what holds for any Safe:
 * transaction links to the Safe UI, the `safe:` prefix, and `canSwitchChain`
 * on NetworkSwitchContext. Resolving a safeTxHash to the on-chain hash is
 * still keyed on the iframe alone (`useWaitForSafeTxHash`; APP-567 covers
 * WalletConnect). For what only the iframe changes — who owns the session —
 * use `useIsSafeApp`.
 */
export const useIsSafeWallet = () => {
  const { address } = useConnection();
  const chainId = useChainId();

  const isSafeApp = useIsSafeApp() && !!address;
  const baseUrl = SAFE_TRANSACTION_SERVICE_URL[chainId];
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/api/v1/safes/${address}`;
    url = new URL(endpoint);
  }

  // Safe-ness of an address doesn't change — cache the answer for the session
  // and skip the call when we already know the wallet is a Safe via the connector.
  const { data: isAddressSafeWallet } = useQuery({
    enabled: Boolean(url && address) && !isSafeApp,
    queryKey: ['is-safe-wallet-found', address, chainId],
    queryFn: () => isSafeWalletFound(url!),
    staleTime: Infinity,
    gcTime: Infinity
  });

  return isSafeApp || !!isAddressSafeWallet;
};
