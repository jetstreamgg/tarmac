import { useQuery } from '@tanstack/react-query';
import type { SafeLookup } from '../model/recipient';
import { readSafeConfig } from '../adapters/safe';

/** The Safe at `address` on `chainId`: config, null for none, undefined while unknown. */
export function useSafeConfig({
  address,
  chainId,
  enabled
}: {
  address: string | undefined;
  chainId: number | undefined;
  enabled: boolean;
}): SafeLookup {
  const { data } = useQuery({
    queryKey: ['bridge-safe-config', address?.toLowerCase(), chainId],
    queryFn: () => readSafeConfig({ chainId: chainId!, address: address! }),
    enabled: enabled && !!address && chainId !== undefined,
    staleTime: 5 * 60_000,
    retry: 1
  });
  return data;
}
