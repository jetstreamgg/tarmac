import { useConnection, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { SAFE_TRANSACTION_SERVICE_URL } from '../shared/constants';
import { useIsSafeApp } from './useIsSafeApp';

// Only a 404 means "not a Safe". Anything else (a rate limit, an outage) is no
// answer: caching it as "no" would send a Safe's transactions down the plain
// wallet path for the whole session.
const isSafeWalletFound = async (url: URL) => {
  const res = await fetch(url);
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Safe transaction service responded ${res.status}`);
};

/**
 * Whether the connected account is a Safe, by any connector: the Safe App
 * iframe, or a Safe paired over WalletConnect. Drives what holds for any Safe:
 * transaction links to the Safe UI, the `safe:` prefix, `canSwitchChain` on
 * NetworkSwitchContext, and resolving a returned safeTxHash to the on-chain
 * hash (`useWaitForSafeTxHash`). For what only the iframe changes — who owns
 * the session — use `useIsSafeApp`.
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
    // A minute and a half of retries, then "not a Safe": an endless retry would have
    // every connected wallet polling the service through an outage.
    retry: 6,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000),
    staleTime: Infinity,
    gcTime: Infinity
  });

  return isSafeApp || !!isAddressSafeWallet;
};
