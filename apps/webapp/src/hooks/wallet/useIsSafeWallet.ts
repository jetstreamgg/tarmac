import { useConnection, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { SAFE_TRANSACTION_SERVICE_URL } from '../shared/constants';
import { useIsSafeApp } from './useIsSafeApp';

// 200 is a Safe and 404 is not; any other reply throws so the answer stays unknown.
const isSafeWalletFound = async (url: URL) => {
  const res = await fetch(url);
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Safe Transaction Service replied ${res.status}`);
};

export type SafeWalletStatus = 'safe' | 'not-safe' | 'checking' | 'unknown';

/**
 * Whether the connected account is a Safe (see `useIsSafeWallet`), with the
 * unresolved states kept apart: `checking` while the Safe service read is in
 * flight, `unknown` when it failed or the chain has no Safe service. Use it
 * where treating a Safe as an EOA is unsafe.
 */
export const useSafeWalletStatus = (): SafeWalletStatus => {
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
  const { data: isAddressSafeWallet, isError } = useQuery({
    enabled: Boolean(url && address) && !isSafeApp,
    queryKey: ['is-safe-wallet-found', address, chainId],
    queryFn: () => isSafeWalletFound(url!),
    staleTime: Infinity,
    gcTime: Infinity,
    // An outage reads as unknown, which blocks callers that fail closed: say so quickly.
    retry: 1
  });

  if (isSafeApp) return 'safe';
  if (!address) return 'not-safe';
  if (!url) return 'unknown';
  if (isAddressSafeWallet !== undefined) return isAddressSafeWallet ? 'safe' : 'not-safe';
  return isError ? 'unknown' : 'checking';
};

/**
 * Whether the connected account is a Safe, by any connector: the Safe App
 * iframe, or a Safe paired over WalletConnect. Drives what holds for any Safe:
 * transaction links to the Safe UI, the `safe:` prefix, and `canSwitchChain`
 * on NetworkSwitchContext. Resolving a safeTxHash to the on-chain hash is
 * still keyed on the iframe alone (`useWaitForSafeTxHash`; APP-567 covers
 * WalletConnect). For what only the iframe changes — who owns the session —
 * use `useIsSafeApp`. Checking or unknown read as false.
 */
export const useIsSafeWallet = () => useSafeWalletStatus() === 'safe';
