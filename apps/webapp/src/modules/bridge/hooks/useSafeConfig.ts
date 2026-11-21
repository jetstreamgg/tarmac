import { useQuery } from '@tanstack/react-query';
import { safeAccountQuery } from '@/hooks/wallet/safeAccount';
import type { SafeLookup } from '../model/recipient';

/**
 * The Safe at `address` on `chainId`: `lookup` is the config, null for none,
 * undefined while unknown; `isChecking` while the first read is in flight.
 * Shares its cache entry with `useSafeWalletStatus`.
 */
export function useSafeConfig({
  address,
  chainId,
  enabled
}: {
  address: string | undefined;
  chainId: number | undefined;
  enabled: boolean;
}): { lookup: SafeLookup; isChecking: boolean } {
  const { data, isLoading } = useQuery({
    ...safeAccountQuery({ address, chainId }),
    enabled: enabled && !!address && chainId !== undefined,
    // Owners and threshold can change, unlike Safe-ness.
    staleTime: 5 * 60_000
  });
  return { lookup: data === undefined ? undefined : data && data.config, isChecking: isLoading };
}
